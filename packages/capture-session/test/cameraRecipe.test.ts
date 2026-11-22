import type {CameraOrbit, Shot} from '../src/script/cameraRecipe.ts'

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
describe('orbit keyframes', () => {
  test('tweens the angle, height and radius while looking at the focus; lens and tool keys do not interrupt the orbit', () => {
    const recipe = parseRecipe([
      {
        time: 0,
        fov: 60,
      },
      {
        time: 1,
        fov: 40,
        tools: {flash: {}},
      },
      {
        time: 2,
        orbit: {
          from: [10, 1, 7],
          to: [14, 3, 5],
          focus: [10, 0, 5],
        },
        tween: 'easeInQuad',
      },
      {
        time: 4,
        position: [14, 3, 9],
      },
    ])
    const shot = sampleRecipe(recipe, 1, fallback)
    expect(shot.fov).toBe(40)
    expect(shot.yaw).toBeCloseTo(22.5)
    expect(shot.pitch).toBeCloseTo(Math.atan2(-1.5, 2.5) * 180 / Math.PI)
    expect(shot.position[0]).toBeCloseTo(10 + 2.5 * Math.sin(Math.PI / 8))
    expect(shot.position[1]).toBe(1.5)
    expect(shot.position[2]).toBeCloseTo(5 + 2.5 * Math.cos(Math.PI / 8))
    expect(sampleRecipe(recipe, 0, fallback).position).toEqual([10, 1, 7])
    expect(sampleRecipe(recipe, 2, fallback).position).toEqual([14, 3, 5])
    expect(sampleRecipe(recipe, 3, fallback).position).toEqual([14, 3, 7])
    expect(recipeToolCalls(recipe).map(call => call.time)).toEqual([1])
  })
  test('can ease height while holding the horizontal orbit and still look at the focus', () => {
    const orbit: CameraOrbit = {
      from: [0, 1, 2],
      to: [4, 5, 0],
      focus: [0, 0, 0],
      heightTween: 'easeInQuad',
    }
    const recipe = parseRecipe([{
      time: 4,
      orbit,
      tween: 'hold',
    }])
    const halfway = sampleRecipe(recipe, 2, fallback)
    expect(halfway.position).toEqual([0, 2, 2])
    expect(halfway.yaw).toBe(0)
    expect(halfway.pitch).toBeCloseTo(-45)
    expect(sampleRecipe(recipe, 4, fallback).position).toEqual(orbit.to!)
    expect(() => parseRecipe([{
      time: 4,
      orbit: {
        ...orbit,
        heightTween: 'bouncy',
      },
    }])).toThrow('unknown orbit.heightTween')
  })
  test('takes the short way across the yaw seam and can add a whole revolution with identical endpoints', () => {
    const recipe = parseRecipe([
      {
        time: 2,
        orbit: {
          from: [1, 1, -1],
          to: [-1, 1, -1],
          focus: [0, 1, 0],
        },
      },
      {
        time: 6,
        orbit: {
          from: [-1, 1, -1],
          to: [-1, 1, -1],
          focus: [0, 1, 0],
          turns: -1,
        },
      },
    ])
    expect(sampleRecipe(recipe, 1, fallback).yaw).toBeCloseTo(180)
    const halfway = sampleRecipe(recipe, 4, fallback)
    expect(halfway.position[0]).toBeCloseTo(1)
    expect(halfway.position[2]).toBeCloseTo(1)
    expect(halfway.yaw).toBeCloseTo(-315)
    expect(sampleRecipe(recipe, 7, fallback).position).toEqual([-1, 1, -1])
  })
  test('an orbit without to ends where it starts', () => {
    const orbit: CameraOrbit = {
      from: [-1, 1, -1],
      focus: [0, 1, 0],
      turns: -1,
    }
    const circling = parseRecipe([{
      time: 4,
      orbit,
    }])
    const explicit = parseRecipe([{
      time: 4,
      orbit: {
        ...orbit,
        to: orbit.from,
      },
    }])
    for (const time of [0, 1, 2, 3, 4]) {
      expect(sampleRecipe(circling, time, fallback)).toEqual(sampleRecipe(explicit, time, fallback))
    }
    expect(sampleRecipe(circling, 2, fallback).position[2]).toBeCloseTo(1)
  })
  test('an orbit without to and turns circles once toward increasing yaw', () => {
    const orbit = {
      from: [-1, 1, -1] as [number, number, number],
      focus: [0, 1, 0] as [number, number, number],
    }
    const circling = parseRecipe([{
      time: 4,
      orbit,
    }])
    const explicit = parseRecipe([{
      time: 4,
      orbit: {
        ...orbit,
        to: orbit.from,
        turns: 1,
      },
    }])
    for (const time of [0, 1, 2, 3, 4]) {
      expect(sampleRecipe(circling, time, fallback)).toEqual(sampleRecipe(explicit, time, fallback))
    }
    expect(sampleRecipe(circling, 4, fallback).yaw - sampleRecipe(circling, 0, fallback).yaw).toBeCloseTo(360)
    const still = parseRecipe([{
      time: 4,
      orbit: {
        ...orbit,
        turns: 0,
      },
    }])
    expect(sampleRecipe(still, 2, fallback).position).toEqual(orbit.from)
  })
  test('rejects incomplete, ambiguous and degenerate arcs at parse time', () => {
    const orbit = {
      from: [1, 0, 0],
      to: [0, 1, 2],
      focus: [0, 0, 0],
    }
    for (const key of [{
      time: 0,
      orbit,
    }, {
      time: 2,
      orbit,
      yaw: 0,
    }, {
      time: 2,
      orbit: {
        ...orbit,
        turns: 0.5,
      },
    }, {
      time: 2,
      orbit: {
        ...orbit,
        to: [1, 2],
      },
    }, {
      time: 2,
      orbit: {
        ...orbit,
        from: [0, 3, 0],
      },
    }]) {
      expect(() => parseRecipe([key])).toThrow('Keyframe 0')
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
