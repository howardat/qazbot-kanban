import path from "node:path";
import tailwindcss from "@tailwindcss/postcss";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, type Plugin } from "vitest/config";

/**
 * In the browser a "use server" module is only a set of calls to the server, as Next compiles it for
 * client code. Tests get the same: every exported function becomes a stub that resolves to undefined,
 * so components import their actions without pulling in the database. Each call is recorded in
 * globalThis.__serverActions as [name, args], for tests to check what would have been saved.
 */
function serverActionStubs(): Plugin {
  return {
    name: "server-action-stubs",
    enforce: "pre",
    transform(code) {
      if (!/^\s*["']use server["']/.test(code)) return;
      const names = [...code.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map((m) => m[1]);
      const stub = (n: string) => `export const ${n} = async (...args) => { (globalThis.__serverActions ??= []).push([${JSON.stringify(n)}, args]); };`;
      return { code: names.map(stub).join("\n"), map: null };
    },
  };
}

// Component tests run in a real (headless) Chromium so layout and scrolling behave as in the app.
export default defineConfig({
  plugins: [serverActionStubs(), react()],
  // Next gives client code an empty process.env (bar NEXT_PUBLIC_*); do the same.
  define: { "process.env": {} },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // postcss.config.mjs names plugins as strings (Next's format), which Vite can't load.
  css: { postcss: { plugins: [tailwindcss()] } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      viewport: { width: 1280, height: 800 },
    },
  },
});
