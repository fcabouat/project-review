/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vite'

/**
 * Single-file build (plan § 8, hardened 04/09): one self-contained HTML that
 * works from file:// — no module fetch, no lazy chunk (reveal is folded in by
 * `inlineDynamicImports`), assets inlined. The classic dist/ remains the
 * static-hosting build; this one is the "double-click" deliverable.
 */
export default defineConfig({
  base: './',
  plugins: [svelte(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 5_000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
