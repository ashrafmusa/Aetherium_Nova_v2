// src/cli.ts
import { Command } from "commander";
import { registerWalletCommands } from "./commands/wallet.js";
import { registerTransactionCommands } from "./commands/transaction.js";
import { registerStakingCommands } from "./commands/staking.js";
import { registerQueryCommands } from "./commands/query.js";
import { registerMineCommand } from "./commands/mine.js";

const program = new Command();

program.name("aetherium-nova").description("CLI for Aetherium Nova").version("2.0.0");

// Register all commands from their respective files
registerWalletCommands(program);
registerTransactionCommands(program);
registerStakingCommands(program);
registerQueryCommands(program);
registerMineCommand(program);

program.parseAsync(process.argv);