// src/contracts.d.ts

declare class SmartContract {
    protected readonly storage: import('./SmartContract').StorageAPI;
    protected readonly blockchain: import('./SmartContract').BlockchainAPI;
    protected readonly transaction: import('./SmartContract').ContractTransaction;
    protected readonly block: import('./SmartContract').ContractBlock;
    protected readonly log: (...args: any[]) => void;
    protected readonly emitEvent: (name: string, ...args: any[]) => void;

    constructor(context: import('./SmartContract').ContractContext);
}