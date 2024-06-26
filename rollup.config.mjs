import { nodeResolve } from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';
import del from 'rollup-plugin-delete';
import external from 'rollup-plugin-peer-deps-external';
import generatePackageJson from 'rollup-plugin-generate-package-json';
import terser from '@rollup/plugin-terser';
import typescript from 'rollup-plugin-typescript2';
import ts from 'typescript';
import pkg from './package.json' assert { type: 'json' };

const peerDependencies = pkg.peerDependencies;

export default [
  {
    input: 'src/index.tsx',
    plugins: [
      external(),
      del({ targets: 'dist/*' }),
      typescript({
        typescript: ts,
      }),
      nodeResolve(),
      copy({
        targets: [
          { src: 'README.md', dest: 'dist' },
          { src: 'CHANGELOG.md', dest: 'dist' },
        ],
      }),
      generatePackageJson({
        baseContents: (pkg) => ({
          ...pkg,
          name: pkg.name,
          main: `${pkg.name}.umd.js`,
          module: `${pkg.name}.esm.js`,
          source: undefined,
          typings: `index.d.ts`,
          scripts: undefined,
          devDependencies: {},
          peerDependencies,
          config: undefined,
        }),
      }),
      terser(),
    ],
    output: [
      {
        name: pkg.name,
        file: `dist/${pkg.name}.umd.js`,
        format: 'umd',
        globals: {
          react: 'react',
          uuid: 'uuid',
        },
        sourcemap: true,
      },
      {
        file: `dist/${pkg.name}.esm.js`,
        format: 'es', sourcemap: true,
        globals: {
          react: 'react',
          uuid: 'uuid',
        },
      },
    ],
  },
];
