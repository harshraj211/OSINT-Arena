module.exports = {
  env: {
    es2022: true,
    node:   true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2022,
  },
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback":  "error",
    "quotes":                 ["error", "double", { avoidEscape: true }],
    "no-unused-vars":         ["warn", { argsIgnorePattern: "^_" }],
    "no-console":             "off",
  },
  overrides: [
    {
      files:   ["**/*.spec.*", "**/*.test.*"],
      env:     { mocha: true, jest: true },
      rules:   {},
    },
  ],
  globals: {},
};