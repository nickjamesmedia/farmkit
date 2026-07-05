import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Written by scripts/build-info.mjs (prebuild): version derived from the
// latest v* git tag plus commits since it, so the badge and feedback reports
// always identify the exact build.
const buildInfo = JSON.parse(
  readFileSync(new URL('./build-info.json', import.meta.url), 'utf8'),
);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(buildInfo.version),
    __GIT_SHA__: JSON.stringify(buildInfo.sha),
    __BUILD_DATE__: JSON.stringify(buildInfo.builtAt),
  },
});
