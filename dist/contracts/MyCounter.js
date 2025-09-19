"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/SmartContract.ts
  var SmartContract = class {
    constructor(context) {
      __publicField(this, "storage");
      __publicField(this, "blockchain");
      __publicField(this, "transaction");
      __publicField(this, "block");
      __publicField(this, "log");
      __publicField(this, "emitEvent");
      this.storage = context.storage;
      this.blockchain = context.blockchain;
      this.transaction = context.transaction;
      this.block = context.block;
      this.log = context.log;
      this.emitEvent = context.emitEvent;
    }
  };

  // src/contracts/MyCounter.ts
  var MyCounter = class extends SmartContract {
    constructor(context) {
      super(context);
      if (this.storage.get("count") === void 0) {
        this.storage.set("count", 0);
        this.emitEvent("CounterInitialized", 0);
      }
    }
    increment() {
      let count = this.storage.get("count") || 0;
      count++;
      this.storage.set("count", count);
      this.log(`Counter incremented to: ${count}`);
      this.emitEvent("Incremented", count, this.transaction.sender);
    }
    getCount() {
      const count = this.storage.get("count") || 0;
      this.log(`Current count is: ${count}`);
      return count;
    }
    callAnotherContract(targetAddress, method, params = [], value = 0) {
      this.log(`Calling another contract: ${targetAddress.slice(0, 10)}...${method} with value ${value}`);
      const result = this.blockchain.callContract(targetAddress, method, params, value);
      this.emitEvent("CalledAnotherContract", targetAddress, method, JSON.stringify(params), value, result);
      return result;
    }
    sendFunds(recipient, amount) {
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
  };

  // temp-entry.ts
  var SmartContract2 = class {
    constructor(context) {
      __publicField(this, "storage");
      __publicField(this, "blockchain");
      __publicField(this, "transaction");
      __publicField(this, "block");
      __publicField(this, "log");
      __publicField(this, "emitEvent");
      this.storage = context.storage;
      this.blockchain = context.blockchain;
      this.transaction = context.transaction;
      this.block = context.block;
      this.log = context.log;
      this.emitEvent = context.emitEvent;
    }
  };
  global.ContractClass = MyCounter;
})();
