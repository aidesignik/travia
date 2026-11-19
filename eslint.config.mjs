import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ---------------------------------------------------------------------------
// travia/design-tokens — keeps the app on its design system (the tokens in
// src/app/globals.css). Flags, in any string or template literal:
//   - a hex colour                  → use a colour token, var(--…)
//   - a Tailwind palette colour     → (text-zinc-500, bg-red-50…) use a token
//   - text-[Npx] off the type scale → 11 / 12 / 13 / 14 / 16 / 18 / 20 / 24
//   - a one-off rounded-[…]          → rounded-chip / -control / -panel /
//                                      -window / -pill (or rounded-full)
//   - a one-off shadow with rgba     → shadow-[var(--shadow-…)]
// A real exception (a third-party brand colour) goes in src/lib/brandColors.ts
// or carries an eslint-disable comment saying why.
// ---------------------------------------------------------------------------
const FONT_SCALE = new Set(["11", "12", "13", "14", "16", "18", "20", "24"]);
const PALETTE =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";
const CHECKS = [
  { re: /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, message: "Hardcoded colour {{value}} — use a colour token (var(--…)) from globals.css." },
  {
    re: new RegExp(`(?<![\\w-])(?:text|bg|border|ring|fill|stroke|from|via|to|divide|outline|accent|decoration)-(?:${PALETTE})-\\d{2,3}\\b`, "g"),
    message: "Tailwind palette colour {{value}} — use a colour token (var(--…)) from globals.css.",
  },
  {
    re: /(?<![\w-])text-\[(\d+(?:\.\d+)?)px\]/g,
    test: (m) => !FONT_SCALE.has(m[1]),
    message: "Font size {{value}} is off the type scale (11/12/13/14/16/18/20/24px).",
  },
  {
    re: /(?<![\w-])rounded(?:-[a-z]{1,2})?-\[(?!var\(--radius-)[^\]]+\]/g,
    message: "One-off radius {{value}} — use rounded-chip / -control / -panel / -window / -pill.",
  },
  {
    re: /(?<![\w-])shadow-\[[^\]]*rgba?\([^\]]*\]/g,
    message: "One-off shadow {{value}} — use a shadow token, shadow-[var(--shadow-…)].",
  },
];

const designTokensRule = {
  meta: { type: "suggestion", schema: [], messages: { violation: "{{message}}" } },
  create(context) {
    function check(node, text) {
      for (const { re, test, message } of CHECKS) {
        for (const m of text.matchAll(re)) {
          if (test && !test(m)) continue;
          context.report({ node, messageId: "violation", data: { message: message.replace("{{value}}", m[0]) } });
        }
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    ignores: [
      // The landing page has its own token set (.lp in landing.css).
      "src/components/landing/**",
      // Generated PDFs/emails can't read the app's CSS variables.
      "src/lib/documents/**",
      // The driver avatar palette is data (one colour set per driver).
      "src/lib/driver-colors.ts",
    ],
    plugins: { travia: { rules: { "design-tokens": designTokensRule } } },
    rules: { "travia/design-tokens": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
