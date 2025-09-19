// src/vm.ts

import ivm from 'isolated-vm';
import type { Transaction } from "./Transaction.js";
import type { Block } from "./chain.js";
import { getBalance, setBalance, setContractStorage, getContractStorage, getContractCode, setContractEvents } from "./ledger.js";
import logger from "./logger.js";
import { GENESIS_CONFIG } from './config.js';
import { getTransactionId, TxType } from './Transaction.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ContractEvent } from './SmartContract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compiledSmartContractBaseCodePath = path.resolve(__dirname, 'SmartContract.js');
const smartContractBaseCodeCompiled = fs.readFileSync(compiledSmartContractBaseCodePath, 'utf-8');

export interface ExecutionResult {
  success: boolean;
  logs: any[];
  storage: Map<string, any>;
  error?: string;
  gasUsed: number;
  events?: ContractEvent[];
  returnValue?: any;
}

export function executeContract(
  contractJavascriptCode: string,
  transaction: Transaction,
  block: Block,
  initialStorage: Map<string, any>,
  readOnly: boolean = false
): ExecutionResult {
  const logs: any[] = [];
  let events: ContractEvent[] = [];
  let storage = new Map(initialStorage);
  let error: string | undefined;
  let currentGasUsed = 0;
  let returnValue: any = undefined;

  logger.debug(`[VM] Executing contract code for tx ${getTransactionId(transaction).slice(0, 10)}...`);

  const gasLimit = transaction.fee * GENESIS_CONFIG.gasCosts.gasPriceUnit;
  const effectiveGasLimit = readOnly ? Infinity : gasLimit;

  if (!readOnly && gasLimit === 0 && (transaction.type === TxType.DEPLOY || transaction.type === TxType.CALL)) {
    logger.error(`[VM] Contract transaction must have a non-zero fee for gas. Tx ID: ${getTransactionId(transaction).slice(0, 10)}`);
    return { success: false, logs, storage: initialStorage, error: "Contract transaction requires gas (fee > 0).", gasUsed: 0, events: [], returnValue };
  }

  const isolate = new ivm.Isolate({ memoryLimit: GENESIS_CONFIG.vmMemoryLimitMB });
  const context = isolate.createContextSync();
  const jail = context.global;

  jail.setSync('global', jail.derefInto());
  
  const consumeGasHostFunction = (amount: number) => {
    currentGasUsed += amount;
    if (currentGasUsed > effectiveGasLimit) {
      throw new Error(`Out of gas! Used ${currentGasUsed}, Limit ${effectiveGasLimit}`);
    }
  };

  const bridge = {
    storage: {
      get: new ivm.Reference((key: string) => {
        consumeGasHostFunction(GENESIS_CONFIG.gasCosts?.STORAGE_READ ?? 10);
        return new ivm.ExternalCopy(storage.get(key)).copyInto();
      }),
      set: new ivm.Reference((key: string, value: any) => {
        if (readOnly) {
          throw new Error("Storage writes (set) are not allowed in read-only mode.");
        }
        consumeGasHostFunction(GENESIS_CONFIG.gasCosts?.STORAGE_WRITE ?? 100);
        storage.set(key, value);
      })
    },
    blockchain: {
      getHeight: new ivm.Reference(() => block.index),
      getBalance: new ivm.Reference((address: string) => {
        consumeGasHostFunction(GENESIS_CONFIG.gasCosts?.STORAGE_READ ?? 10);
        return getBalance(address);
      }),
      transfer: new ivm.Reference((recipient: string, amount: number) => {
        if (readOnly) {
            throw new Error("Transfers are not allowed in read-only mode.");
        }
        consumeGasHostFunction(GENESIS_CONFIG.gasCosts?.TRANSFER_BY_CONTRACT ?? 200);
        if (amount <= 0) {
            throw new Error("Transfer amount must be positive.");
        }
        let contractBalance = getBalance(transaction.to);
        if (contractBalance < amount) {
            throw new Error(`Contract has insufficient funds for transfer. Available: ${contractBalance}, Required: ${amount}`);
        }
        setBalance(transaction.to, contractBalance - amount);
        setBalance(recipient, getBalance(recipient) + amount);
        logger.debug(`[VM] Contract ${transaction.to.slice(0,10)}... transferred ${amount} to ${recipient.slice(0,10)}...`);
        return true;
      }),
      callContract: new ivm.Reference((targetAddress: string, methodName: string, params: any[] = [], value: number = 0) => {
        if (readOnly) {
            throw new Error("Value transfers in nested calls are not allowed in read-only mode.");
        }
        consumeGasHostFunction(GENESIS_CONFIG.gasCosts?.INTER_CONTRACT_CALL ?? 500);
        const targetCode = getContractCode(targetAddress);
        if (!targetCode) {
            throw new Error(`Target contract does not exist at ${targetAddress}`);
        }
        const nestedTransaction: Transaction = {
            type: TxType.CALL,
            from: transaction.to,
            to: targetAddress,
            amount: value,
            fee: 0,
            nonce: 0,
            timestamp: transaction.timestamp,
            data: { method: methodName, params: params },
            signature: '', publicKey: ''
        };
        const targetInitialStorage = getContractStorage(targetAddress);
        const nestedResult = executeContract(targetCode, nestedTransaction, block, targetInitialStorage, readOnly);
        if (!nestedResult.success) {
            throw new Error(`Nested contract call failed: ${nestedResult.error}`);
        }
        consumeGasHostFunction(nestedResult.gasUsed);
        if (!readOnly) {
          setContractStorage(targetAddress, nestedResult.storage);
        }
        logs.push(...nestedResult.logs);
        if (nestedResult.events) { events.push(...nestedResult.events); }
        logger.debug(`[VM] Nested call to ${targetAddress.slice(0,10)}... method ${methodName} successful. Gas used: ${nestedResult.gasUsed}`);
        return nestedResult.returnValue;
      })
    },
    transaction: new ivm.ExternalCopy({ ...transaction, data: transaction.data }),
    block: new ivm.ExternalCopy({ ...block, proposer: block.proposer ?? '' }),
    log: new ivm.Reference((...args: any[]) => {
      consumeGasHostFunction(GENESIS_CONFIG.gasCosts?.LOG ?? 5);
      logs.push(args);
    }),
    emitEvent: new ivm.Reference((name: string, ...args: any[]) => {
      if (readOnly) {
        throw new Error("Contract events (emitEvent) are not allowed in read-only mode.");
      }
      consumeGasHostFunction(GENESIS_CONFIG.gasCosts?.LOG ?? 50);
      events.push({ name, args });
    }),
    setReturnValue: new ivm.Reference((value: any) => {
        returnValue = value;
    })
  };
  
  jail.setSync('context', new ivm.ExternalCopy(bridge).copyInto({ release: true }));

  currentGasUsed += contractJavascriptCode.length * (GENESIS_CONFIG.gasCosts?.BYTECODE_BYTE ?? 0.05);

  try {
    const smartContractBaseScript = isolate.compileScriptSync(smartContractBaseCodeCompiled);
    smartContractBaseScript.runSync(context, { timeout: GENESIS_CONFIG.vmExecutionTimeoutMs });
    
    const contractClassName = transaction.data?.contractClassName as string;
    if (!contractClassName) {
      throw new Error("Contract deployment transaction is missing 'contractClassName' in its data.");
    }

    const userContractScript = isolate.compileScriptSync(contractJavascriptCode);
    userContractScript.runSync(context, { timeout: GENESIS_CONFIG.vmExecutionTimeoutMs });

    const contractClass = jail.getSync(contractClassName);
    if (!contractClass || typeof contractClass.deref() !== 'function') {
      throw new Error(`Contract class '${contractClassName}' not found or is not a class in the compiled code.`);
    }

    const instance = contractClass.deref().newSync(jail.getSync('context').deref());
    
    const method = transaction.data?.method;
    if (!method) {
      throw new Error("No method specified for contract call.");
    }
    if (typeof instance[method] !== 'function') {
      throw new Error(`Method "${method}" is not defined or is not a function in the contract.`);
    }

    consumeGasHostFunction(GENESIS_CONFIG.gasCosts?.BASE_EXECUTION ?? 100);

    const methodResult = instance[method](...(transaction.data?.params || []));
    if (methodResult !== undefined) {
        bridge.setReturnValue.applySync(undefined, [methodResult]);
    }

    if (!readOnly && events.length > 0) {
      setContractEvents(getTransactionId(transaction), events);
    }

    const finalStorage = readOnly ? initialStorage : storage;

    return { success: true, logs, storage: finalStorage, gasUsed: currentGasUsed, events, returnValue };
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
    logger.error(`[VM] Contract execution failed for tx ${getTransactionId(transaction).slice(0, 10)}...: ${error}`);
    return { success: false, logs, storage: initialStorage, error, gasUsed: currentGasUsed, events: [], returnValue };
  } finally {
    if (!isolate.isDisposed) isolate.dispose();
  }
}