import {afterEach, expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import PortraitCollection from '#component/PortraitCollection'

import {useGallery} from '../../src/lib/gallery.ts'
import samplePortraits from './fixtures/portraits.ts'

const initial = {...useGallery.getInitialState()}
afterEach(() => {
  Object.assign(useGallery.getInitialState(), initial)
})
const render = () => renderToStaticMarkup(createElement(PortraitCollection))
test('the collection grids every work of the world as a thumbnail tile, counting the interacted ones', () => {
  Object.assign(useGallery.getInitialState(), {portraits: samplePortraits})
  const html = render()
  expect(html).toContain('data-testid="portrait-collection"')
  expect(html.match(/data-testid="collection-item"/gu)).toHaveLength(samplePortraits.length)
  expect(html.match(/<canvas\b/gu)).toHaveLength(samplePortraits.length)
  for (const portrait of samplePortraits) {
    expect(html).toContain(`data-portrait="${portrait.id}"`)
  }
  expect(html).toContain(`0 of ${samplePortraits.length} interacted with`)
  // Tiles open a menu on right click and meet their work at its own ratio.
  expect(html.match(/aria-haspopup="menu"/gu)).toHaveLength(samplePortraits.length)
  expect(html).toContain('width="256"')
  expect(html).toContain('height="256"')
})
test('only a work already interacted with carries its rich tooltip of name, flavor text, author and year', () => {
  const dated = {
    ...samplePortraits[0],
    interacted: true,
    year: 1889,
  }
  const undated = {
    ...samplePortraits[1],
    interacted: true,
  }
  const untouched = {...samplePortraits[2]}
  Object.assign(useGallery.getInitialState(), {portraits: [dated, undated, untouched]})
  const html = render()
  expect(html).toContain('2 of 3 interacted with')
  expect(html.match(/data-testid="collection-tooltip"/gu)).toHaveLength(2)
  expect(html.match(/popover="hint"/gu)).toHaveLength(2)
  for (const portrait of [dated, undated]) {
    expect(html).toContain(`>${portrait.title}</p>`)
    expect(html).toContain(`>${portrait.description}</p>`)
    expect(html).toContain(`<span>${portrait.creator}</span>`)
    expect(html).toContain(`aria-label="${portrait.title} by ${portrait.creator}"`)
    // The tile names the tooltip it shows interest in, and that tooltip is in the page.
    const tilePattern = new RegExp(`aria-label="${portrait.title} by ${portrait.creator}"[^>]*interestfor="([^"]+)"`, 'u')
    const tooltipId = tilePattern.exec(html)?.[1]
    expect(tooltipId).toBeString()
    expect(html).toMatch(new RegExp(`<div id="${tooltipId}"[^>]*data-testid="collection-tooltip"`, 'u'))
  }
  expect(html).toContain('<span>1889</span>')
  expect(html).toContain('<span>Undated</span>')
  // The untouched work gives none of its plate away, in the tooltip or anywhere else.
  expect(html).not.toContain(untouched.title)
  expect(html).not.toContain(untouched.description)
  expect(html).not.toContain(untouched.creator)
  expect(html).toContain('aria-label="Artwork you have not interacted with yet"')
  expect(html.match(/interestfor=/gu)).toHaveLength(2)
  expect(html.match(/data-interacted="true"/gu)).toHaveLength(2)
})
test('a world without works says so instead of gridding nothing', () => {
  Object.assign(useGallery.getInitialState(), {portraits: []})
  const html = render()
  expect(html).toContain('No artworks in this world yet.')
  expect(html).toContain('0 of 0 interacted with')
  expect(html).not.toContain('data-testid="collection-item"')
  expect(html).not.toContain('<canvas')
})
