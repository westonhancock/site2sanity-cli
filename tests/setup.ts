/**
 * Jest setup file - runs before all tests
 */

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests (optional)
// Uncomment if you want quieter test output:
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

// Clean up after all tests
afterAll(() => {
  // Any global cleanup
});
