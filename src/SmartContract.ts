// src/SmartContract.ts

export interface StorageAPI {
  get(key: string): any;
  set(key: string, value: any): void;
}

export interface ContractEvent {
  name: string;
  args: any[];
}

export interface BlockchainAPI {
  getHeight(): number;
  getBalance(address: string): number;
  callContract(address: string, method: string, params?: any[], value?: number): any;
  transfer(recipient: string, amount: number): boolean;
}

export interface ContractTransaction {
  sender: string;
  value: number;
  fee: number;
  data?: {
    method?: string;
    params?: any[];
  };
  to: string;
}

export interface ContractBlock {
  height: number;
  timestamp: number;
  proposer: string;
}

export interface ContractContext {
  storage: StorageAPI;
  blockchain: BlockchainAPI;
  transaction: ContractTransaction;
  block: ContractBlock;
  log: (...args: any[]) => void;
  emitEvent: (name: string, ...args: any[]) => void;
}

// The base class that all contracts will extend
export abstract class SmartContract {
  protected readonly storage: StorageAPI;
  protected readonly blockchain: BlockchainAPI;
  protected readonly transaction: ContractTransaction;
  protected readonly block: ContractBlock;
  protected readonly log: (...args: any[]) => void;
  protected readonly emitEvent: (name: string, ...args: any[]) => void;

  constructor(context: ContractContext) {
    this.storage = context.storage;
    this.blockchain = context.blockchain;
    this.transaction = context.transaction;
    this.block = context.block;
    this.log = context.log;
    this.emitEvent = context.emitEvent;
  }
}