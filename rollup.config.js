import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';

export default {
  input: 'src/index.js',
  output: {
    dir: 'public/',
    format: 'iife',
  },
  plugins: [
    svelte(),
    resolve({ browser: true }),
    replace({
      'process.env.NODE_ENV': `'${process.env.NODE_ENV}'`,
    }),
  ],
  watch: { clearScreen: false },
};
