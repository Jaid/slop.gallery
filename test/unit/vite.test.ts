import {expect, test} from 'bun:test'

import postcss from 'postcss'
import {resolveConfig} from 'vite'
import browserslistTargetPlugin from 'vite-plugin-browserslist-target'

test.each(['development', 'staging', 'production'])('Vite %s keeps the shared pipeline and mode-specific output', async mode => {
  const config = await resolveConfig({
    mode,
    configLoader: 'native',
  }, 'build')
  expect(config.build.outDir).toBe(mode === 'production' ? 'dist' : `out/build/${mode}`)
  const inferredConfig = await resolveConfig({
    mode,
    configFile: false,
    plugins: [browserslistTargetPlugin()],
  }, 'build')
  expect(config.build.target).toEqual(inferredConfig.build.target)
  expect(config.build.cssTarget).toEqual(config.build.target)
  expect(config.plugins.some(plugin => plugin.name === 'browserslist-target')).toBe(true)
  expect(config.plugins.some(plugin => plugin.name === 'title')).toBe(true)
  expect(config.plugins.some(plugin => plugin.name === 'loading-screen')).toBe(mode === 'production')
  expect(config.plugins.some(plugin => plugin.name === 'vite:react-compiler')).toBe(true)
  if (mode === 'production') {
    expect(config.build.sourcemap).toBe(false)
    expect(config.build.assetsDir).toBe('')
    expect(config.build.minify).toBe('terser')
  } else {
    expect(config.build.sourcemap).toBe(true)
  }
})
test('production CSS preserves resources and stacking levels used outside the stylesheet', async () => {
  const config = await resolveConfig({
    mode: 'production',
    configLoader: 'native',
  }, 'build')
  const options = config.css.postcss
  if (!options || typeof options === 'string') {
    throw new Error('Expected inline PostCSS configuration.')
  }
  const result = await postcss(options.plugins).process('@font-face {font-family: ExternalFont; src: url(/font.woff2)} @keyframes externalAnimation {to {opacity: 0}} .overlay {z-index: 1000}', {from: undefined})
  expect(result.css).toContain('ExternalFont')
  expect(result.css).toContain('externalAnimation')
  expect(result.css).toContain('z-index:1000')
})
