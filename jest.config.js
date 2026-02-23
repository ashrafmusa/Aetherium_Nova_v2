export default {
    transform: {
        '^.+\\.ts?$': '@swc/jest',
    },
    testEnvironment: 'node',
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
};