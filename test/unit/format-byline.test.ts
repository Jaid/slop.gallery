import {expect, test} from 'bun:test'

import formatByline from '../../src/lib/gallery/formatByline.ts'

test('a byline names the creator and the year, leaving out either nobody knows', () => {
  expect(formatByline('Jane Doe', 1924)).toBe('Jane Doe · 1924')
  expect(formatByline('Jane Doe')).toBe('Jane Doe')
  expect(formatByline(undefined, 1924)).toBe('1924')
  expect(formatByline('', 1924)).toBe('1924')
  expect(formatByline('Jane Doe', 0)).toBe('Jane Doe · 0')
  expect(formatByline()).toBe('')
})
