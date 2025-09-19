import { SmartContract, type ContractContext } from './SmartContract.js';

export class CounterContract extends SmartContract {
  constructor(context: ContractContext) {
    super(context);
  }

  public getCount(): void {
    const count: number = this.storage.get("count") || 0;
    this.log(`Current count is: ${count}`);
  }

  public increment(): void {
    let count: number = this.storage.get("count") || 0;
    count++;
    this.storage.set("count", count);
    this.log(`Counter incremented by ${this.transaction.sender}. New count: ${count}`);
  }

  public add(value: number): void {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error("Input value must be an integer.");
    }
    let count: number = this.storage.get("count") || 0;
    count += value;
    this.storage.set("count", count);
    this.log(`Added ${value}. New count is: ${count}`);
  }
}