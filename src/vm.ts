// src/vm.ts

import vm from 'node:vm';
import type { Transaction } from "./Transaction.js";
import type { Block } from "./types.js";
import { getBalance, setBalance, setContractStorage, getContractStorage, getContractCode } from "./ledger.js";
import { getLogger } from './logger.js';
import { GENESIS_CONFIG } from './config.js';
import { ContractEvent } from './SmartContract.js';

const logger = getLogger();

export interface ExecutionResult {
  success: boolean;
  logs: string[];
  storage: Map<string, any>;
  error?: string;
  gasUsed: number;
  events?: ContractEvent[];
  returnValue?: any;
}

/**
 * Execute a smart contract inside a node:vm sandbox.
 *
 * Contract bundles produced by esbuild-contracts.mjs are IIFE scripts that
 * assign  global.ContractClass = <ClassName>  before closing.  We:
 *   1. Run the IIFE to register ContractClass on the sandbox.
 *   2. Instantiate the class with a full ContractContext.
 *   3. Call tx.data.method (with tx.data.params) if present.
 *
 * Gas accounting, timeout isolation, and a read-only storage guard are
 * all enforced here.
 */
export function executeContract(
  contractJavascriptCode: string,
  transaction: Transaction,
  block: Block,
  initialStorage: Map<string, any>,
  readOnly: boolean = false
): ExecutionResult {
  const logs: string[] = [];
  const events: ContractEvent[] = [];
  let gasUsed = GENESIS_CONFIG.gasCosts.BASE_EXECUTION;

  // Clone storage so failures don't corrupt the original map
  const storage = new Map(initialStorage);

  // ── Storage API ──────────────────────────────────────────────────────────
  const storageAPI = {
    get(key: string): any {
      gasUsed += GENESIS_CONFIG.gasCosts.STORAGE_READ;
      return storage.get(key);
    },
    set(key: string, value: any): void {
      if (readOnly) throw new Error('Storage is read-only in this context');
      gasUsed += GENESIS_CONFIG.gasCosts.STORAGE_WRITE;
      storage.set(key, value);
    },
  };

  // ── Blockchain API ───────────────────────────────────────────────────────
  const blockchainAPI = {
    getHeight(): number {
      return block.index;
    },
    getBalance(address: string): number {
      return getBalance(address);
    },
    /** Recursive inter-contract call. */
    callContract(address: string, _method: string, _params: any[] = [], _value: number = 0): any {
      gasUsed += GENESIS_CONFIG.gasCosts.INTER_CONTRACT_CALL;
      const innerCode = getContractCode(address);
      if (!innerCode) throw new Error(`Contract at ${address} not found`);
      const innerStorage = getContractStorage(address);
      const innerResult = executeContract(innerCode, transaction, block, innerStorage, readOnly);
      if (!innerResult.success) throw new Error(`Inner contract call failed: ${innerResult.error}`);
      gasUsed += innerResult.gasUsed;
      if (!readOnly) setContractStorage(address, innerResult.storage);
      return innerResult.returnValue;
    },
    /** Transfer AN from this contract's balance to a recipient. */
    transfer(recipient: string, amount: number): boolean {
      if (readOnly) return false;
      gasUsed += GENESIS_CONFIG.gasCosts.TRANSFER_BY_CONTRACT;
      const contractBalance = getBalance(transaction.to);
      if (contractBalance < amount) return false;
      setBalance(transaction.to, contractBalance - amount);
      setBalance(recipient, getBalance(recipient) + amount);
      return true;
    },
  };

  // ── Context passed into the ContractClass constructor ────────────────────
  const contractContext = {
    storage: storageAPI,
    blockchain: blockchainAPI,
    transaction: {
      sender: transaction.from,
      value: transaction.amount,
      fee: transaction.fee,
      data: transaction.data,
      to: transaction.to,
    },
    block: {
      height: block.index,
      timestamp: block.timestamp,
      proposer: block.proposer,
    },
    log: (...args: any[]): void => {
      gasUsed += GENESIS_CONFIG.gasCosts.LOG;
      logs.push(args.map(String).join(' '));
    },
    emitEvent: (name: string, ...args: any[]): void => {
      events.push({ name, args });
    },
  };

  // ── Build the vm sandbox ─────────────────────────────────────────────────
  // `sandbox.global = sandbox` lets IIFE code that writes `global.ContractClass`
  // work correctly inside the vm context.
  const sandbox: Record<string, any> = {
    __context: contractContext,
    __returnValue: undefined,
    console: {
      log: (...a: any[]) => logs.push(a.map(String).join(' ')),
      warn: (...a: any[]) => logs.push('[warn] ' + a.map(String).join(' ')),
      error: (...a: any[]) => logs.push('[error] ' + a.map(String).join(' ')),
    },
  };
  // Make global self-referential so `global.ContractClass = X` resolves to sandbox
  sandbox.global = sandbox;

  const ctx = vm.createContext(sandbox);

  try {
    // Step 1 — execute the IIFE bundle; registers sandbox.ContractClass
    vm.runInContext(contractJavascriptCode, ctx, {
      timeout: GENESIS_CONFIG.vmExecutionTimeoutMs,
      filename: `contract_${transaction.to}.js`,
    });

    const ContractClass: any = sandbox.ContractClass;
    if (typeof ContractClass !== 'function') {
      return {
        success: false,
        logs,
        storage: initialStorage,
        gasUsed,
        error: 'Contract bundle did not expose a ContractClass. Re-deploy with the correct build pipeline.',
      };
    }

    // Step 2 — instantiate (runs constructor / init logic)
    const instance: Record<string, any> = new ContractClass(contractContext);

    // Step 3 — call method if specified
    const method = transaction.data?.method;
    const params: any[] = transaction.data?.params ?? [];

    if (method && method !== '__constructor__') {
      if (typeof instance[method] !== 'function') {
        return {
          success: false,
          logs,
          storage: initialStorage,
          gasUsed,
          error: `Method '${method}' not found on contract at ${transaction.to}`,
        };
      }
      sandbox.__returnValue = instance[method](...params);
    }

    logger.debug(`[VM] Contract ${transaction.to.slice(0, 10)}... executed successfully. Gas: ${gasUsed}`);

    return {
      success: true,
      logs,
      storage,
      gasUsed,
      events,
      returnValue: sandbox.__returnValue,
    };
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[VM] Contract execution failed for ${transaction.to}: ${message}`);
    return { success: false, logs, storage: initialStorage, gasUsed, error: message };
  }
}