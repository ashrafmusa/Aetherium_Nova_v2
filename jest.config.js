export default {
    transform: {
        '^.+\\.ts?$': '@swc/jest',
        '^.+\.m?js$': '@swc/jest',
    },
    // Do NOT ignore @noble/* packages — they are pure ESM and must be transformed
    transformIgnorePatterns: [
        'node_modules[\\/](?!@noble[\\/])',
    ],
    extensionsToTreatAsEsm: ['.ts'],
    testEnvironment: 'node',
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
};