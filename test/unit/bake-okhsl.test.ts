import {expect, test} from 'bun:test'

import {transformSync} from '@babel/core'

import {bakeOkhsl} from '#src/lib/vite/bakeOkhslPlugin.ts'

test('the build packs literal OkHSL colors and leaves seeded colors and shadowed bindings for runtime', () => {
  const source = `import hsl from 'okhsl'
export const paint = hsl.integer(346, 86, 67)
export const turn = hue => hsl.integer(hue, 86, 67)
export const other = hsl => hsl.integer(346, 86, 67)`
  const code = transformSync(source, {plugins: [bakeOkhsl]})!.code!
  expect(code).toContain('paint = 15887292')
  expect(code).toContain('hue => hsl.integer(hue, 86, 67)')
  expect(code).toContain('hsl => hsl.integer(346, 86, 67)')
})
