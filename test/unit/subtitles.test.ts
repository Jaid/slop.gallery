import {expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {narrationWords, timingFromCharacters} from 'use-narrator/core'

import NarrationSubtitles from '#component/NarrationSubtitles'
import {narratorName} from '#component/NarratorTag'

import {letterStarts, subtitleGroupAt, subtitleGroups, subtitleWordState} from '../../src/lib/audio/subtitles.ts'

const groupTexts = (text: string) => subtitleGroups(text, narrationWords(text)).map(group => text.slice(group.from, group.to))
test('subtitles show one sentence at a time, and runs of short sentences together', () => {
  expect(groupTexts('An Uninvited Tea Guest. The tea is cold. The guest is shellfish. Nobody is having the afternoon they had imagined.')).toEqual([
    'An Uninvited Tea Guest. The tea is cold.',
    'The guest is shellfish.',
    'Nobody is having the afternoon they had imagined.',
  ])
  expect(groupTexts('His Unbothered Majesty. A ruler of impeccable breeding and absolutely no qualifications.')).toEqual([
    'His Unbothered Majesty.',
    'A ruler of impeccable breeding and absolutely no qualifications.',
  ])
  const groups = subtitleGroups('One. Two.', narrationWords('One. Two.'))
  expect(groups).toEqual([{
    first: 0,
    last: 2,
    from: 0,
    to: 9,
  }])
})
test('before speech the first group shows, after it the last one', () => {
  const text = 'His Unbothered Majesty. A ruler of impeccable breeding and absolutely no qualifications.'
  const groups = subtitleGroups(text, narrationWords(text))
  expect(subtitleGroupAt(groups, -1)).toBe(0)
  expect(subtitleGroupAt(groups, 2)).toBe(0)
  expect(subtitleGroupAt(groups, 3)).toBe(1)
  expect(subtitleGroupAt(groups, 99)).toBe(1)
})
test('a word is current until shortly after its end, then spoken; the end of the narration speaks everything', () => {
  const timing = {words: [{
    from: 0,
    to: 2,
    start: 0,
    end: 0.5,
  }, {
    from: 3,
    to: 5,
    start: 1,
    end: 1.5,
  }]}
  expect(subtitleWordState(0, {
    word: 0,
    progress: 0.5,
    seconds: 0.25,
  }, timing, false)).toBe('current')
  expect(subtitleWordState(0, {
    word: 0,
    progress: 1,
    seconds: 0.55,
  }, timing, false)).toBe('current')
  expect(subtitleWordState(0, {
    word: 0,
    progress: 1,
    seconds: 0.8,
  }, timing, false)).toBe('spoken')
  expect(subtitleWordState(1, {
    word: 0,
    progress: 1,
    seconds: 0.8,
  }, timing, false)).toBe('upcoming')
  expect(subtitleWordState(1, {
    word: 0,
    progress: 1,
    seconds: 0.8,
  }, timing, true)).toBe('spoken')
  // Native speech has no timeline, so its word stays current until the next one starts.
  expect(subtitleWordState(1, {
    word: 1,
    progress: 1,
  }, undefined, false)).toBe('current')
})
test('letters of words without spans of their own are spread evenly over the word', () => {
  const starts = letterStarts({words: [{
    from: 0,
    to: 4,
    start: 1,
    end: 2,
  }]}, 4)!
  expect([...starts]).toEqual([1, 1.25, 1.5, 1.75])
})
test('words keep their character spans while words without any are spread', () => {
  const text = 'ab cd'
  const starts = letterStarts({
    words: [{
      from: 0,
      to: 2,
      start: 0,
      end: 1,
    }, {
      from: 3,
      to: 5,
      start: 2,
      end: 3,
    }],
    characters: [[0.2, 0.4], [0.6, 0.9], null, null, null],
  }, text.length)!
  // The space belongs to no word and is never shown as a letter.
  expect(Array.from(starts, start => Math.round(start * 1000) / 1000)).toEqual([0.2, 0.6, 0, 2, 2.5])
})
test('letters without a span of their own start with the letter before them or their word', () => {
  const text = 'Hi, “you”'
  const characters = Array.from(text, (character, index) => (/\p{L}/u.test(character) ? [index, index + 0.5] as const : null))
  const starts = letterStarts(timingFromCharacters(text, characters), text.length)!
  expect([...starts]).toEqual([0, 1, 1, 0, 5, 5, 6, 7, 7])
  expect(letterStarts(undefined, 4)).toBeUndefined()
})
test('subtitles render the current group’s words letter by letter, with or without a timing', () => {
  const text = 'Hi there. A ruler of impeccable breeding and absolutely no qualifications at all.'
  const narration = {
    instanceId: 'a',
    source: 'audio' as const,
    status: 'before' as const,
    text,
  }
  const plain = renderToStaticMarkup(createElement(NarrationSubtitles, {narration}))
  expect(plain).toContain('data-word="1"')
  expect(plain).toContain('data-letter="3">t</span>')
  expect(plain).not.toContain('data-fill')
  // Later sentences are only there as hidden sizing copies, without words to paint.
  expect(plain).toContain('ruler')
  expect(plain).not.toContain('data-word="2"')
  expect(plain).not.toContain('data-letter="10"')
  expect(plain.match(/data-group="sizer"/g)).toHaveLength(2)
  const characters = Array.from(text, (_, index) => [index / 10, index / 10 + 0.05] as const)
  const lettered = renderToStaticMarkup(createElement(NarrationSubtitles, {narration: {
    ...narration,
    timing: timingFromCharacters(text, characters),
  }}))
  expect(lettered).toBe(plain)
})
test('subtitles are headed by the narrator’s tag, spectrum included only for recordings', () => {
  const narration = {
    instanceId: 'a',
    source: 'audio' as const,
    status: 'playing' as const,
    text: 'Hi there.',
  }
  const html = renderToStaticMarkup(createElement(NarrationSubtitles, {narration}))
  const tag = html.indexOf('data-testid="narrator-tag"')
  expect(tag).toBeGreaterThan(-1)
  expect(tag).toBeLessThan(html.indexOf('data-word="0"'))
  expect(html).toContain(`>${narratorName}</span>`)
  expect(html).toContain('data-testid="narrator-avatar"')
  expect(html).toContain('data-testid="audio-bars"')
  expect(html).not.toContain('aria-label="Audio guide"')
  const spoken = renderToStaticMarkup(createElement(NarrationSubtitles, {narration: {
    ...narration,
    source: 'browser',
  }}))
  expect(spoken).toContain('data-testid="narrator-avatar"')
  expect(spoken).not.toContain('data-testid="audio-bars"')
})
