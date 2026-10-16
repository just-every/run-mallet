import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { docsSite } from './src/site/docs/build/plugin.ts'

// The run site's build (rer build --site, src/site/pages.tsx): the docs module and React, never the app's
// vite.config.ts, whose Worker and Start plugins do not run in Node. public/ is copied by the site build's asset list,
// so the stylesheets' /brand and /fonts URLs stay as they are.
export default defineConfig({
  cacheDir: fileURLToPath(new URL('./.cache/vite-site', import.meta.url)),
  publicDir: false,
  plugins: [docsSite(), react()],
})
