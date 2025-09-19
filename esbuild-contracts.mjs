// esbuild-contracts.mjs

import { build } from 'esbuild';
import path from 'path';
import fs from 'fs';

const smartContractBaseCodeCompiledPath = path.resolve(process.cwd(), 'dist', 'SmartContract.js');
const smartContractBaseCodeCompiled = fs.readFileSync(smartContractBaseCodeCompiledPath, 'utf-8');

const contractDir = path.resolve(process.cwd(), 'src', 'contracts');
const contractFiles = fs.readdirSync(contractDir).filter(file => file.endsWith('.ts'));

for (const contractFile of contractFiles) {
    const baseName = path.basename(contractFile, '.ts');
    const outfile = path.resolve(process.cwd(), 'dist', 'contracts', `${baseName}.js`);
    
    // Create a temporary entry file that combines the base contract and the user contract
    const tempEntryFile = path.resolve(process.cwd(), 'temp-entry.ts');
    
    // Change: Correct the import path to point to the user's contract file
    const entryContent = `
    // Inlined SmartContract base class
    ${smartContractBaseCodeCompiled}

    // User's contract
    import { ${baseName} } from './src/contracts/${baseName}.js';

    // This makes the class available to the VM
    global.ContractClass = ${baseName};
    `;
    fs.writeFileSync(tempEntryFile, entryContent);

    try {
        await build({
            entryPoints: [tempEntryFile],
            bundle: true,
            outfile,
            platform: 'node',
            format: 'iife',
            target: 'es2015',
            minify: false,
        });
    } catch (e) {
        console.error(`❌ Failed to build contract ${contractFile}:`, e);
        process.exit(1);
    } finally {
        fs.unlinkSync(tempEntryFile);
    }
}

console.log('✅ Contracts bundled successfully!');