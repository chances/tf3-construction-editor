import { createHandler } from "./api.ts";
import { loadConfig } from "./config.ts";

const config = loadConfig();
console.log(
  `installRoot: ${
    config.installRoot ??
      "(not set, base game models are not indexed. Set CEDIT_INSTALL_ROOT or installRoot in cedit.config.json)"
  }`,
);
console.log(`modsRoot:    ${config.modsRoot}`);
Deno.serve({ port: config.port, hostname: "127.0.0.1" }, createHandler(config));
