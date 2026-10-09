import { fixupConfigRules } from "@eslint/compat";
import pluginJs from "@eslint/js";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import globals from "globals";
import tseslint from "typescript-eslint";


export default [
  {
    ignores: ["build/**"],
  },
  {
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...fixupConfigRules(pluginReactConfig),
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "semi": ["error", "always"],
    },
  },
  {
    files: ["*.config.js"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "semi": ["error", "always"],
    },
  },
];
