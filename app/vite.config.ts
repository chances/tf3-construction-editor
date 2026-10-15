import { fileURLToPath } from "node:url";

const workspaceMember = (name: string) =>
  fileURLToPath(new URL(`../${name}/mod.ts`, import.meta.url));

export default {
  resolve: {
    alias: {
      "@cedit/schema": workspaceMember("schema"),
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
};
