import {expect, test} from 'bun:test'
import {fileURLToPath} from 'node:url'

import postcss from 'postcss'
import {preprocessCSS, resolveConfig} from 'vite'

const config = await resolveConfig({
  configLoader: 'runner',
  logLevel: 'silent',
}, 'serve')
function expectStaticStyles(code: string) {
  postcss.parse(code).walkDecls(declaration => {
    expect(declaration.prop).not.toStartWith('--')
    expect(declaration.value).not.toMatch(/\bvar\s*\(/u)
  })
}
test('components use real, locally scoped Sass module exports', async () => {
  const sassModuleGlob = new Bun.Glob('src/components/**/style.module.sass')
  const files = [...sassModuleGlob.scanSync()].toSorted()
  expect(files.length).toBeGreaterThan(0)
  for (const file of files) {
    const source = await Bun.file(file).text()
    const compiled = await preprocessCSS(source, fileURLToPath(new URL(`../../${file.replaceAll('\\', '/')}`, import.meta.url)), config)
    expectStaticStyles(compiled.code)
    const modules = compiled.modules
    expect(modules, file).toBeDefined()
    const component = await Bun.file(file.replace('style.module.sass', 'index.tsx')).text()
    expect(component, file).toContain("import css from './style.module.sass'")
    for (const [, name] of component.matchAll(/\bcss\.(\w+)/gu)) {
      expect(modules, `${file}: ${name}`).toHaveProperty(name)
    }
    const names = Object.values(modules ?? {})
    postcss.parse(compiled.code).walkRules(rule => {
      if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes')) {
        return
      }
      for (const selector of rule.selectors) {
        expect(names.some(name => selector.includes(`.${name}`) || selector.includes(`#${name}`)), `${file}: ${selector}`).toBe(true)
      }
    })
  }
})
test('components use no global stylesheets or literal class names', async () => {
  const stylesheetGlob = new Bun.Glob('src/**/*.css')
  expect([...stylesheetGlob.scanSync()]).toEqual([])
  const componentGlob = new Bun.Glob('src/components/**/*.tsx')
  for (const file of componentGlob.scanSync()) {
    const source = await Bun.file(file).text()
    expect(source, file).not.toMatch(/className=["']/u)
    expect(source, file).not.toContain("import './style.css'")
  }
})
test('document styling uses local fonts without font downloads', async () => {
  const source = await Bun.file('src/style.sass').text()
  const compiled = await preprocessCSS(source, fileURLToPath(new URL('../../src/style.sass', import.meta.url)), config)
  expectStaticStyles(compiled.code)
  expect(compiled.code).toContain('font-family')
  expect(compiled.code).not.toContain('url(')
  expect(await Bun.file('index.html').text()).not.toContain('/fonts/')
})
