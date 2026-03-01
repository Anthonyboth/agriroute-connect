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
        {
          selector: "CallExpression[callee.property.name='toLocaleString'][arguments.0.value='pt-BR']",
          message: "Currency formatting via toLocaleString is prohibited in UI. Use precoPreenchidoDoFrete() from '@/lib/precoPreenchido' for freight prices, or formatBRL from '@/lib/formatters' for non-freight monetary values.",
        },
        {
          selector: "BinaryExpression[operator='/'][left.property.name='price'][right.property.name='required_trucks']",
          message: "Dividing price by required_trucks is PROHIBITED. Use precoPreenchidoDoFrete() which handles pricing types correctly.",
        },
        {
          selector: "BinaryExpression[operator='/'][right.property.name='companyTruckCount'][left.property.name='displayPrice']",
          message: "Dividing displayPrice by truck count is PROHIBITED. Use precoPreenchidoDoFrete() from '@/lib/precoPreenchido'.",
        },
        // 🔒 REGRA UNIVERSAL: bloquear freight.price renderizado diretamente em JSX
        // freight.price é o TOTAL e NUNCA deve ser exibido fora do painel do solicitante.
        // Usar precoPreenchidoDoFrete(..., {unitOnly:true}) ou useFreightPriceUI.
        {
          selector: "JSXExpressionContainer > MemberExpression[property.name='price'][object.property.name='freight']",
          message: "PROIBIDO renderizar freight.price em JSX. Isso mostra o TOTAL. Use precoPreenchidoDoFrete(freight, {unitOnly:true}).primaryText para exibir preço unitário.",
        },
        {
          selector: "JSXExpressionContainer > CallExpression[callee.name='formatBRL'] > MemberExpression[property.name='price'][object.property.name='freight']",
          message: "PROIBIDO usar formatBRL(freight.price) em JSX. Isso renderiza o TOTAL. Use precoPreenchidoDoFrete() ou useFreightPriceUI.",
        },
        // 🔒 REGRA v7: bloquear payment.amount em JSX para fretes
        {
          selector: "JSXExpressionContainer > MemberExpression[property.name='amount'][object.property.name='payment']",
          message: "PROIBIDO renderizar payment.amount em JSX para fretes. Use precoPreenchidoDoFrete() ou precoFechadoParaUI().",
        },
        // 🔒 REGRA v7: bloquear getPricePerTruck(freight.price, ...) — derivação proibida
        {
          selector: "CallExpression[callee.name='getPricePerTruck'] > MemberExpression[property.name='price'][object.property.name='freight']",
          message: "PROIBIDO usar getPricePerTruck(freight.price). Use precoPreenchidoDoFrete() que resolve o tipo correto sem dividir.",
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
  // Allow currency formatting in canonical pricing files, formatters, and tests
  {
    files: [
      "src/lib/precoPreenchido.ts",
      "src/lib/precoFechado.ts",
      "src/lib/normalizeFreightPricing.ts",
      "src/lib/freightPriceContract.ts",
      "src/lib/formatters.ts",
      "src/lib/proposal-utils.ts",
      "src/security/multiTruckPriceGuard.ts",
      "src/hooks/useFreightCalculator/**",
      "src/hooks/useFreightPriceDisplay.ts",
      "src/components/driver/DriverFinancialReport.tsx",
      "src/components/CompanyFinancialDashboard.tsx",
      "src/components/FreightAnalyticsDashboard.tsx",
      "src/components/RouteRentabilityReport.tsx",
      "src/components/reports/**",
      "src/components/CompletedServicesPayment.tsx",
      "src/components/ServicePaymentHistory.tsx",
      "src/pages/driver/DriverOngoingTab.tsx",
      "src/components/admin-panel/AdminFreights.tsx",
      "src/components/proposal/ProposalCard.tsx",
      "src/components/ServiceProposalModal.tsx",
      "src/components/CompanyDashboard.tsx",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='has_registration']",
          message: "Direct access to 'has_registration' is prohibited.",
        },
      ],
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
      "src/lib/precoFechado.ts",
      "src/lib/__tests__/precoPreenchido.test.ts",
      "src/hooks/usePrecoPreenchido.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  }
);
