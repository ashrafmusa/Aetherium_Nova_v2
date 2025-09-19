import { SmartContract, type ContractContext } from '../SmartContract.js';

// Change: Class is now exported directly
export class MyCounter extends SmartContract {
  constructor(context: ContractContext) {
    super(context);
    if (this.storage.get("count") === undefined) {
      this.storage.set("count", 0);
      this.emitEvent("CounterInitialized", 0);
    }
  }

  public increment(): void {
    let count: number = this.storage.get("count") || 0;
    count++;
    this.storage.set("count", count);
    this.log(`Counter incremented to: ${count}`);
    this.emitEvent("Incremented", count, this.transaction.sender);
  }

  public getCount(): number {
    const count: number = this.storage.get("count") || 0;
    this.log(`Current count is: ${count}`);
    return count;
  }

  public callAnotherContract(targetAddress: string, method: string, params: any[] = [], value: number = 0): any {
    this.log(`Calling another contract: ${targetAddress.slice(0, 10)}...${method} with value ${value}`);
    const result = this.blockchain.callContract(targetAddress, method, params, value);
    this.emitEvent("CalledAnotherContract", targetAddress, method, JSON.stringify(params), value, result);
    return result;
  }

  public sendFunds(recipient: string, amount: number): boolean {
    this.log(`Contract attempting to send ${amount} to ${recipient.slice(0, 10)}...`);
    if (this.blockchain.getBalance(this.transaction.to) < amount) {
        this.log("Contract has insufficient native AN balance for direct transfer.");
        this.emitEvent("NativeTransferFailed", recipient, amount, "Insufficient AN balance");
        return false;
    }
    const success = this.blockchain.transfer(recipient, amount);
    if (success) {
      this.emitEvent("FundsSent", recipient, amount);
      this.log(`Contract successfully sent ${amount} to ${recipient.slice(0, 10)}...`);
    } else {
      this.emitEvent("FundsSendFailed", recipient, amount);
      this.log("Contract failed to send funds.");
    }
    return success;
  }
}