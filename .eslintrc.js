module.exports = {
  root: true,
  env: {
    node: true,
    mocha: true
  },
  parser: "@typescript-eslint/parser",
  plugins: [
    "security",
    "@typescript-eslint"
  ],
  extends: [
    "eslint:recommended",
    "plugin:security/recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  rules: {
    "quotes": ["warn", "double", "avoid-escape"],
    "indent": ["warn", 2, { "SwitchCase": 1 }],
    "semi": ["warn", "always"],
    "@typescript-eslint/no-unused-vars": "warn",
    "no-console": "off",
    "camelcase": "warn",
    "require-atomic-updates": "off",
    "prefer-destructuring": ["warn", {
      "array": false,
      "object": true
    }, {
      "enforceForRenamedProperties": false
    }],
    "security/detect-object-injection": "off",
    "object-curly-spacing": ["warn", "always"],
    "prefer-const": ["warn"]
  },
  overrides: [
    {
      "files": ["test/**/*.ts"],
      "rules": {
        "@typescript-eslint/ban-ts-comment": ["off"]
      }
    }
  ]
};
  