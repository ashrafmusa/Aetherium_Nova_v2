import { SmartContract } from './SmartContract.js';
export class CounterContract extends SmartContract {
    constructor(context) {
        super(context);
    }
    getCount() {
        const count = this.storage.get("count") || 0;
        this.log(`Current count is: ${count}`);
    }
    increment() {
        let count = this.storage.get("count") || 0;
        count++;
        this.storage.set("count", count);
        this.log(`Counter incremented by ${this.transaction.sender}. New count: ${count}`);
    }
    add(value) {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
            throw new Error("Input value must be an integer.");
        }
        let count = this.storage.get("count") || 0;
        count += value;
        this.storage.set("count", count);
        this.log(`Added ${value}. New count is: ${count}`);
    }
}
