import {expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import ArtworkDropOverlay from '#component/ArtworkDropOverlay'

test('the drop overlay distinguishes hanging, loose placement, collecting under the pause menu and rejected images', () => {
  for (const [collecting, rejected, valid, title] of [
    [false, false, false, 'Make an entrance.'],
    [false, false, true, 'It would look lovely here.'],
    [true, false, true, 'Straight into the collection.'],
    [false, true, true, 'Not quite a canvas.'],
    [true, true, false, 'Not quite a canvas.'],
  ] as const) {
    const html = renderToStaticMarkup(createElement(ArtworkDropOverlay, {
      collecting,
      rejected,
      valid,
    }))
    expect(html).toContain(title)
    expect(html).toContain('data-testid="drop-overlay"')
    expect(html).not.toContain('class="undefined')
  }
})
