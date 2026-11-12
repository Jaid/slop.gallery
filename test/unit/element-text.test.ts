import {expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import {Face} from '#component/ElementText'

const face = (fontFamily: string) => renderToStaticMarkup(createElement(Face, {
  color: '#696653',
  fontFamily,
  fontSize: 54,
  fontWeight: 400,
  height: 85,
  maxWidth: 0.9,
  text: 'Cornelius van Honk',
  width: 1536,
}))
test('a line’s font family reaches CSS as it is, so generic families stay generic', () => {
  // Quoted, sans-serif would name a font nobody has and fall back to the browser’s standard font, a serif one.
  expect(face('sans-serif')).toContain('font-family:sans-serif')
  expect(face('Georgia, serif')).toContain('font-family:Georgia, serif')
  expect(face('sans-serif')).not.toContain('&quot;')
})
test('a line is fitted into its share of the face', () => {
  const markup = face('sans-serif')
  expect(markup).toContain('width:1536px;height:85px')
  expect(markup).toContain('max-width:90%')
  expect(markup).toContain('data-fit="">Cornelius van Honk<')
})
