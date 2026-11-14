import {afterEach, expect, test} from 'bun:test'

import {renderToStaticMarkup} from 'react-dom/server'

import ArtworkCollection from '#component/ArtworkCollection'
import ArtworkCollectionItem from '#component/ArtworkCollectionItem'

import {useGallery} from '../../src/lib/gallery.ts'
import samples from './fixtures/portraits.ts'

const initial = {...useGallery.getInitialState()}
afterEach(() => Object.assign(useGallery.getInitialState(), initial))
test('the collection contains the live world’s works on both floors, including loose, imported and reserved works', () => {
  const portraits = samples.slice(0, 4).map((portrait, index) => ({
    ...portrait,
    id: `collection-${index}`,
    position: [0, index % 2 ? -5 : 2, 0] as [number, number, number],
    hung: index !== 1,
    imported: index === 2,
    reserved: index === 3,
  }))
  Object.assign(useGallery.getInitialState(), {portraits})
  const html = renderToStaticMarkup(<ArtworkCollection />)
  expect(html).toContain(`${portraits.length} artworks`)
  expect(html.match(/data-artwork=/gu)).toHaveLength(portraits.length)
  for (const portrait of portraits) {
    expect(html).toContain(`data-artwork="${portrait.id}"`)
  }
  expect(html).not.toContain('data-artwork="goose"')
  expect(html).not.toContain('role="tooltip"')
  expect(html).toContain('data-tone="imported"')
  expect(html).toContain('aria-haspopup="menu"')
})
test.each([false, true])('metadata is revealed only by interaction, imported = %s', imported => {
  const portrait = {
    ...samples[0],
    imported,
    title: 'A private title',
    description: 'Its private flavor text.',
    creator: 'Its private author',
    year: 2026,
  }
  const render = (interacted: boolean) => renderToStaticMarkup(<ArtworkCollectionItem
    index={0} menuOpen={false} portrait={{
      ...portrait,
      interacted,
    }} onMenu={() => {}}
  />)
  const untouched = render(false)
  for (const text of [portrait.title, portrait.description, portrait.creator, String(portrait.year)]) {
    expect(untouched).not.toContain(text)
    expect(render(true)).toContain(text)
  }
  expect(untouched).toContain('aria-label="Unexplored artwork 1"')
  expect(untouched).not.toContain('interestfor=')
  expect(render(true)).toContain('popover="hint" role="tooltip"')
  expect(render(true)).toContain('interestfor=')
})
test('an undated interacted work has an explicit byline and a stable interest invoker while its menu is open', () => {
  const html = renderToStaticMarkup(<ArtworkCollectionItem
    index={0} menuOpen portrait={{
      ...samples[0],
      interacted: true,
      year: undefined,
    }} onMenu={() => {}}
  />)
  expect(html).toContain('Undated')
  expect(html).toContain('aria-expanded="true"')
  expect(html).toContain('interestfor=')
})
test('an empty world has a useful collection state without an empty grid', () => {
  Object.assign(useGallery.getInitialState(), {portraits: []})
  const html = renderToStaticMarkup(<ArtworkCollection />)
  expect(html).toContain('0 artworks')
  expect(html).toContain('No artworks yet.')
  expect(html).not.toContain('<ul')
})
