import type {Shot} from '../src/script/cameraRecipe.ts'

import {describe, expect, test} from 'bun:test'

import {parseRecipe, recipeToolCalls, sampleRecipe, sampleWireframe, tweens} from '../src/script/cameraRecipe.ts'

const fallback: Shot = {
  position: [0, 1.7, 0],
  yaw: 0,
  pitch: 0,
  roll: 0,
  fov: 60,
}
describe('camera recipes', () => {
  test('every tween runs from 0 to 1', () => {
    for (const [name, tween] of Object.entries(tweens)) {
      expect(tween(0), name).toBeCloseTo(0)
      expect(tween(1), name).toBeCloseTo(1)
    }
    expect(tweens.easeInOutCubic(0.5)).toBeCloseTo(0.5)
    expect(tweens.easeOutQuad(0.5)).toBeCloseTo(0.75)
    expect(tweens.hold(0.99)).toBe(0)
  })
  test('animates each property on its own track and holds it outside its keyframes', () => {
    const recipe = parseRecipe([
      {
        time: 0,
        position: [0, 0, 0],
        yaw: 0,
      },
      {
        time: 1,
        fov: 30,
      },
      {
        time: 2,
        position: [4, 0, -2],
        yaw: 720,
        tween: 'easeInQuad',
      },
    ])
    expect(sampleRecipe(recipe, 0.5, fallback)).toEqual({
      position: [0.25, 0, -0.125],
      yaw: 45,
      pitch: 0,
      roll: 0,
      fov: 30,
    })
    expect(sampleRecipe(recipe, 3, fallback)).toMatchObject({
      position: [4, 0, -2],
      yaw: 720,
    })
  })
  test('uses the tween of the keyframe a segment leads to', () => {
    const recipe = parseRecipe([
      {
        time: 0,
        pitch: 0,
        tween: 'hold',
      },
      {
        time: 1,
        pitch: 10,
        tween: 'hold',
      },
      {
        time: 2,
        pitch: 20,
      },
    ])
    expect(sampleRecipe(recipe, 0.5, fallback).pitch).toBe(0)
    expect(sampleRecipe(recipe, 1, fallback).pitch).toBe(10)
    expect(sampleRecipe(recipe, 1.5, fallback).pitch).toBe(15)
  })
  test('rejects malformed recipes with the offending keyframe', () => {
    expect(() => parseRecipe({keyframes: []})).toThrow('non-empty JSON array')
    expect(() => parseRecipe([{time: 1}, {time: 1}])).toThrow('Keyframe 1 must come after keyframe 0')
    expect(() => parseRecipe([{
      time: 0,
      tween: 'bouncy',
    }])).toThrow('unknown tween "bouncy"')
    expect(() => parseRecipe([{
      time: 0,
      position: [1, 2],
    }])).toThrow('Keyframe 0 needs position')
    expect(() => parseRecipe([{
      time: 0,
      fov: 200,
    }])).toThrow('between 0 and 180')
    expect(() => parseRecipe([{
      time: 0,
      zoom: 2,
    }])).toThrow('unknown property “zoom”')
    expect(() => parseRecipe([{
      time: 0,
      wireframe: 'in',
    }])).toThrow('Keyframe 0 needs wireframe as an object')
    for (const tools of ['throw_prop', ['throw_prop'], {throw_prop: 'prop-orb-spook'}]) {
      expect(() => parseRecipe([{
        time: 0,
        tools,
      }])).toThrow('Keyframe 0 needs tools as an object')
    }
  })
})
describe('tool keyframes', () => {
  test('every keyframe’s tools run once at its time, in the order they are given and the keyframes come', () => {
    const recipe = parseRecipe([
      {
        time: 0,
        yaw: 0,
      },
      {
        time: 1.5,
        tools: {
          throw_prop: {
            prop: 'prop-orb-spook',
            portrait: 'goose',
          },
          set_wireframe: {enabled: false},
        },
      },
      {
        time: 2,
        tools: {end_warmup: {}},
      },
    ])
    expect(recipeToolCalls(recipe)).toEqual([
      {
        time: 1.5,
        name: 'throw_prop',
        input: {
          prop: 'prop-orb-spook',
          portrait: 'goose',
        },
      },
      {
        time: 1.5,
        name: 'set_wireframe',
        input: {enabled: false},
      },
      {
        time: 2,
        name: 'end_warmup',
        input: {},
      },
    ])
    expect(recipeToolCalls(parseRecipe([{time: 0}, {time: 1}]))).toEqual([])
  })
})
describe('wireframe keyframes', () => {
  const recipe = parseRecipe([
    {
      time: 0,
      yaw: 0,
    },
    {
      time: 1,
      wireframe: {
        direction: 'in',
        position: [0, 0, 0],
        speed: 20,
        mode: 'combined',
      },
    },
    {
      time: 2,
      wireframe: {
        position: [2, 0, 0],
      },
      tween: 'easeInQuad',
    },
    {
      time: 3,
      wireframe: {
        direction: 'out',
        position: [10, 0, 0],
      },
    },
    {
      time: 4,
      yaw: 90,
    },
  ])
  test('nothing is sent before the first wireframe keyframe, and recipes without any send nothing', () => {
    expect(sampleWireframe(recipe, 0.5)).toBeUndefined()
    expect(sampleWireframe(parseRecipe([{time: 0}, {time: 1}]), 0.5)).toBeUndefined()
  })
  test('fields hold from their keyframe on, while position travels with the tween', () => {
    expect(sampleWireframe(recipe, 1)).toMatchObject({
      direction: 'in',
      speed: 20,
      mode: 'combined',
      position: [0, 0, 0],
    })
    expect(sampleWireframe(recipe, 1.5)!.position).toEqual([0.5, 0, 0])
    expect(sampleWireframe(recipe, 2.5)).toMatchObject({
      direction: 'in',
      position: [2, 0, 0],
    })
  })
  test('a keyframe with a direction starts a new flood, so nothing travels into it', () => {
    expect(sampleWireframe(recipe, 2.99)!.position).toEqual([2, 0, 0])
    expect(sampleWireframe(recipe, 3.5)).toMatchObject({
      direction: 'out',
      speed: 20,
      position: [10, 0, 0],
    })
  })
})
