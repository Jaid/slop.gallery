import type {FilmOptions} from '../../scripts/film.ts'
import type {SnapOptions} from '../../scripts/snap.ts'

import {expect, test} from 'bun:test'

import {normalizeOptions} from '../../scripts/lib/headlessGallery.ts'

const spec = {
  fov: {type: 'string'},
  height: {type: 'string'},
  paused: {type: 'string'},
  seed: {type: 'string'},
  swiftshader: {type: 'boolean'},
} as const
test('the default exports of snap and film take numbers and booleans for text options', () => {
  const snapOptions = {
    fov: 70,
    height: 4320,
    paused: true,
    'text-overlays': true,
  } satisfies SnapOptions
  const filmOptions = {
    fps: 30,
    seed: [0, 'Hanover'],
    audio: false,
  } satisfies FilmOptions
  // @ts-expect-error TS2322 a boolean option takes no number
  const wrongSwitch: SnapOptions = {'text-overlays': 1}
  expect([snapOptions, filmOptions, wrongSwitch]).toHaveLength(3)
})
test('they reach the command line’s parsing as text, while boolean options and lists keep their shape', () => {
  expect(normalizeOptions<{
    fov: string
    height: string
    paused: string
    seed: Array<string>
    swiftshader: boolean
  }>({
    fov: 70,
    height: '2160',
    paused: true,
    seed: [0, 'Hanover'],
    swiftshader: true,
  }, spec)).toEqual({
    fov: '70',
    height: '2160',
    paused: 'true',
    seed: ['0', 'Hanover'],
    swiftshader: true,
  })
})
test('undefined options are left out, so they don’t override defaults', () => {
  expect({
    height: '1080',
    ...normalizeOptions<{height: string}>({height: undefined}, spec),
  }).toEqual({height: '1080'})
})
