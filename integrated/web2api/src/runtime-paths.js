import { join } from "node:path";

const baseDirectory = process.env.APP_BASE_DIR || process.cwd();
const dataDirectory = process.env.APP_DATA_DIR || join(baseDirectory, "data");

export const runtimePaths = Object.freeze({
  baseDirectory,
  dataDirectory,
  envFile: join(baseDirectory, ".env"),
  publicDirectory: join(baseDirectory, "public"),
  distDirectory: join(baseDirectory, "dist")
});
