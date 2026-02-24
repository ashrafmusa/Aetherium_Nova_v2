export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
    '^.+\\.m?js$': 'babel-jest',
  },
  // Do NOT ignore @noble/* packages — they are pure ESM and must be transformed
  transformIgnorePatterns: [
    'node_modules[\\/](?!@noble[\\/])',
  ],
  forceExit: true,
  testTimeout: 15000,
};