require("@typespec/eslint-config-typespec/patch/modern-module-resolution");

module.exports = {
  plugins: ["@typespec/eslint-plugin"],
  extends: ["@typespec/eslint-config-typespec", "plugin:@typespec/eslint-plugin/recommended"],
  parserOptions: { tsconfigRootDir: __dirname },
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        "vars": "all",
        "args": "all",
        "ignoreRestSiblings": true,
        "argsIgnorePattern": "^_"
      }
    ],
    "max-lines-per-function": [
      "warn",
      {
        "max": 100,
        "skipBlankLines": true,
        "skipComments": true,
        "IIFEs": false
      }
    ],
    "@typescript-eslint/semi": [
      "warn", "always"
    ]
  },
  overrides: [
    {
      files: ["test/**/*.ts"],
      rules: {
        "max-lines-per-function": "off"
      }
    }
  ]
};
