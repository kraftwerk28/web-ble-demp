import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/index.js',
  output: {
    dir: 'public/',
    format: 'iife',
  },
  plugins: [
    svelte(),
    resolve({ browser: true }),
  ],
  watch: { clearScreen: false },
};
