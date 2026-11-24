import {expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import EngravedPlateFace from '#component/EngravedPlateFace'

import engravedPlate from '../../src/lib/gallery/engravedPlate.ts'

import css from '../../src/components/EngravedPlateFace/style.module.sass'

test('a plate’s lettering is rastered as densely across as up', () => {
  const [width, height] = engravedPlate.texture
  const [plateWidth, plateHeight] = engravedPlate.size
  expect(Math.abs(height / plateHeight - width / plateWidth)).toBeLessThan(width / plateWidth / height)
})
test('a plate’s face holds its heading over its byline, or its heading alone in the middle', () => {
  const [width, height] = engravedPlate.texture
  const both = renderToStaticMarkup(createElement(EngravedPlateFace, {
    heading: 'Antiphon',
    byline: 'GPT-6.2 Astra · 2026',
  }))
  expect(both).toContain(`width:${width}px;height:${height}px`)
  expect(both).toContain(`class="${css.line} ${css.heading}">Antiphon<`)
  expect(both).toContain(`class="${css.line} ${css.byline}">GPT-6.2 Astra · 2026<`)
  const alone = renderToStaticMarkup(createElement(EngravedPlateFace, {heading: 'Block'}))
  expect(alone).toContain(`class="${css.line} ${css.heading} ${css.alone}">Block<`)
  expect(alone).not.toContain(css.byline)
})
