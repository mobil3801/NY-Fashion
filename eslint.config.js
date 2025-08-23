import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true }],


      "@typescript-eslint/no-unused-vars": "off",
      "no-undef": "error",

      // Prevent importing from wrong debug context paths to avoid duplicate contexts
      // Prevent importing old permission utilities
      "no-restricted-imports": [
      "error",
      {
        "patterns": [
        {
          "group": ["@/contexts/DebugContext", "@/debug/DebugProvider", "**/debug/DebugProvider"],
          "message": "Import debug functionality from '@/debug' barrel export only to use the consolidated context."
        },
        {
          "group": ["@/utils/permissions", "**/utils/permissions"],
          "message": "Use '@/auth/usePermissions' hook instead of old permission utilities for consistency."
        }],

        "paths": [
        {
          "name": "../debug/DebugProvider",
          "message": "Import from '@/debug' barrel only."
        },
        {
          "name": "./debug/DebugProvider",
          "message": "Import from '@/debug' barrel only."
        },
        {
          "name": "@/utils/permissions",
          "message": "Use '@/auth/usePermissions' hook instead."
        }]

      }]

    }
  }
);