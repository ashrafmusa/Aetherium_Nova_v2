// src/SmartContract.ts
// The base class that all contracts will extend
export class SmartContract {
    storage;
    blockchain;
    transaction;
    block;
    log;
    emitEvent;
    constructor(context) {
        this.storage = context.storage;
        this.blockchain = context.blockchain;
        this.transaction = context.transaction;
        this.block = context.block;
        this.log = context.log;
        this.emitEvent = context.emitEvent;
    }
}
