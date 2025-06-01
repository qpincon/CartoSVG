import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    // to remove when this PR is merged https://github.com/shrhdk/text-to-svg/pull/76
    nodePolyfills({
      include: ['path'],
      globals: {
        global: true,
        Buffer: true,
        process: true
      },
      protocolImports: true
    })],
})
