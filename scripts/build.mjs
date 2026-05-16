import { build } from 'vite';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { createViteConfig } from '../vite.shared.mjs';

async function runBuild() {
  const config = createViteConfig('production');
  const outDir = config.build?.outDir ?? 'dist';
  const outputPath = path.resolve(process.cwd(), outDir);

  await rm(outputPath, { recursive: true, force: true });

  await build({
    ...config,
    configFile: false,
    mode: 'production',
    build: {
      ...config.build,
      outDir,
      emptyOutDir: false,
    },
  });
}

runBuild().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
