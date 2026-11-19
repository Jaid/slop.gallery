import type {Linter} from 'eslint'

import {makeEslintConfig} from 'eslint-config-jaid'
import branchComponent from 'eslint-plugin-branch-component'

const config: Array<Linter.Config> = [
  {ignores: ['private/**', 'out/**', 'dist/**', 'temp/**']},
  ...makeEslintConfig(),
  branchComponent.configs.recommended,
  {
    files: ['{src,packages}/**/*.{ts,tsx}'],
    ignores: ['**/test/**'],
    rules: {
      'no-restricted-syntax': ['error', ...[
        ['three', 'three/webgpu'],
        ['@react-three/drei', '@react-three/drei/webgpu'],
        ['@react-three/fiber/legacy', '@react-three/fiber'],
        ['@react-three/fiber/webgpu', '@react-three/fiber'],
      ].map(([from, to]) => ({
        selector: `:matches(Literal.source, CallExpression[callee.name="require"] > Literal.arguments)[value="${from}"]`,
        message: `Import from ${to} instead of ${from} for WebGPU.`,
      })), {
        selector: "Identifier[name='WebGLRenderer']",
        message: 'Use WebGPURenderer.',
      }, {
        selector: ':matches(Identifier, JSXOpeningElement > JSXIdentifier.name)[name=/^(meshBasicMaterial|meshStandardMaterial)$/]',
        message: 'Use a WebGPU node material.',
      }],
    },
  },
  {
    // Workspace packages resolve their peers from the root install.
    files: ['packages/**/package.json'],
    rules: {'package-json/specify-peers-locally': 'off'},
  },
]

export default config
