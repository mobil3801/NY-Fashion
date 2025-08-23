import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
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
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true }],

      // Accessibility rules
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/html-has-lang": "error",
      "jsx-a11y/img-redundant-alt": "error",
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/mouse-events-have-key-events": "error",
      "jsx-a11y/no-access-key": "error",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/no-distracting-elements": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/scope": "error",

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