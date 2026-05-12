module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  moduleNameMapper: {
    "^@auto-invest/shared$": "<rootDir>/../../shared/src/index.ts",
  },
  clearMocks: true,
};
