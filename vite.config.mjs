import { defineConfig } from 'vite';
import { createViteConfig } from './vite.shared.mjs';

export default defineConfig(({ mode }) => createViteConfig(mode));
