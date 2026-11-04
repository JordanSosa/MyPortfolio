// Types for scripts/lint-css.mjs (imported by tests/lint-css.test.ts).
export interface CssFinding {
  rule: "foreign-bare" | "shared-bare" | "hub-leak" | "short-name" | "split-definition" | "borrowed" | "refinement";
  level: "error" | "warning";
  cls: string;
  sheet: string;
  line: number;
  sel: string;
  user?: string;
  msg: string;
}
export interface CssLintResult {
  findings: CssFinding[];
  errors: number;
  warnings: number;
  ms: number;
  stats: { files: number; sheets: number; embedded: number; rules: number; classes: number; uses: number };
}
export function lintCss(opt?: { rev?: string; dir?: string }): CssLintResult;
