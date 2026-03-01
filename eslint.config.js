import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "react": react,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "react/jsx-key": ["error", { "checkFragmentShorthand": true }],
      "react/no-array-index-key": "error",
      // 🔒 Anti-regression: block direct access to has_registration outside the helper
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='has_registration']",
          message: "Direct access to 'has_registration' is prohibited. Use checkFreightRequesterHasRegistration() from '@/lib/checkFreightRequester' instead.",
        },
      ],
      // 🔒 Anti-regression: block manual price formatting with unit strings outside canonical helper
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/lib/formatters",
              importNames: ["getPricePerTruck"],
              message: "Use getCanonicalFreightPrice() from '@/lib/freightPriceContract' instead of getPricePerTruck().",
            },
            {
              name: "@/hooks/useFreightPriceDisplay",
              importNames: ["getFreightPriceDisplay", "useFreightPriceDisplay"],
              message: "Use usePrecoPreenchido() from '@/hooks/usePrecoPreenchido' or precoPreenchidoDoFrete() from '@/lib/precoPreenchido' instead.",
            },
          ],
        },
      ],
    },
  },
  // Allow has_registration access ONLY in the helper and its tests
  {
    files: [
      "src/lib/checkFreightRequester.ts",
      "src/lib/__tests__/checkFreightRequester.test.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Allow getPricePerTruck in legacy files being migrated and the formatters module itself
  {
    files: [
      "src/lib/formatters.ts",
      "src/lib/proposal-utils.ts",
      "src/lib/freightPriceContract.ts",
      "src/lib/__tests__/freightPriceContract.test.ts",
      "src/hooks/useFreightPriceDisplay.ts",
      "src/hooks/__tests__/useFreightPriceDisplay.test.ts",
      "src/lib/precoPreenchido.ts",
      "src/lib/__tests__/precoPreenchido.test.ts",
      "src/hooks/usePrecoPreenchido.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  }
);
