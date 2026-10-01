import { defineConfig } from 'vite';
import pkg from './package.json';

export default defineConfig({
  define: { __VERSION__: JSON.stringify(pkg.version) },
  build: {
    lib: { entry: 'src/index.ts', name: 'LociEngine', formats: ['iife'], fileName: () => 'loci-engine.iife.js' },
    target: 'es2019',
    // the CSS minifier drops unprefixed backdrop-filter (keeps only -webkit-), which kills the glass blur in Chrome
    cssMinify: false,
    sourcemap: true,
  },
});
