import { fileURLToPath } from "node:url";
import deno from "@deno/vite-plugin";

const workspaceMember = (name: string) =>
  fileURLToPath(new URL(`../${name}/mod.ts`, import.meta.url));

export default {
  resolve: {
    alias: {
      "@cedit/schema": workspaceMember("schema"),
    },
  },
  plugins: [deno()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
};
