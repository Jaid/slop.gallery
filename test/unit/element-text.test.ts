import {expect, test} from 'bun:test'

import puppeteer from 'puppeteer-core'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import {Face} from '#component/ElementText'

import compileStyle from './helpers/compileStyle.ts'

const face = (fontFamily: string, text = 'Cornelius van Honk', fontSize = 54) => renderToStaticMarkup(createElement(Face, {
  color: '#696653',
  fontFamily,
  fontSize,
  fontWeight: 400,
  height: 85,
  maxWidth: 0.9,
  text,
  width: 1536,
}))
test('a line’s font family reaches CSS as it is, so generic families stay generic', () => {
  // Quoted, sans-serif would name a font nobody has and fall back to the browser’s standard font, a serif one.
  expect(face('sans-serif')).toContain('font-family:sans-serif')
  expect(face('Georgia, serif')).toContain('font-family:Georgia, serif')
})
test('a line is limited to its share of the face', () => {
  const markup = face('sans-serif')
  expect(markup).toContain('width:1536px;height:85px')
  expect(markup).toContain('max-width:90%')
  expect(markup).toContain('>Cornelius van Honk<')
})
test.skipIf(!Bun.env.BROWSER)('a line too long for the face shrinks into its share, a short one keeps its size', async () => {
  const {code} = await compileStyle('src/components/ElementText/style.module.sass')
  await using browser = await puppeteer.launch({executablePath: Bun.env.BROWSER})
  const page = await browser.newPage()
  await page.setContent(`<style>body{margin:0}${code}</style>${face('sans-serif', 'The Feline Overlord’s Morning Glare at Dawn', 120)}${face('sans-serif', 'Short')}`)
  const lines = await page.$$eval('body > div', faces => faces.map(element => {
    const range = document.createRange()
    range.selectNodeContents(element.firstElementChild!)
    const text = range.getBoundingClientRect()
    const bounds = element.getBoundingClientRect()
    return {
      left: text.left - bounds.left,
      right: bounds.right - text.right,
      width: text.width,
    }
  }))
  const [long, short] = lines
  expect(long.width).toBeLessThanOrEqual(1536 * 0.9 + 1)
  expect(long.width).toBeGreaterThan(1536 * 0.9 - 4)
  expect(Math.abs(long.left - long.right)).toBeLessThan(1)
  expect(short.width).toBeLessThan(1536 * 0.5)
  expect(Math.abs(short.left - short.right)).toBeLessThan(1)
}, 60_000)
