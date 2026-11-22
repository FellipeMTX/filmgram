import { relative } from "node:path";

const config = {
  "*.{ts,tsx}": [
    "prettier --write",
    "eslint",
    (files) =>
      `vitest related --run --passWithNoTests -- ${files.map((file) => JSON.stringify(relative(process.cwd(), file))).join(" ")}`,
  ],
  "*.{js,mjs}": ["prettier --write", "eslint"],
  "*.{css,json,md,yaml,yml}": ["prettier --write"],
};

export default config;
