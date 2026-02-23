export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  forceExit: true,
  testTimeout: 15000,
};