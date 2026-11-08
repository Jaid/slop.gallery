import type {PropThrowInput} from '../../src/lib/webmcp/throwProp.ts'
import type {WebmcpBridge} from '../../src/lib/webmcp/tools.ts'

import {expect, test} from 'bun:test'

import registerWebmcp from '../../src/lib/webmcp/register.ts'
import createWebmcpTools from '../../src/lib/webmcp/tools.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const bridge: WebmcpBridge = {
  analyzeWorld: () => ({
    rooms: {},
    elsewhere: {
      meshes: [],
      items: [],
      lights: [],
    },
    globalLights: [],
  }),
  downloadFrame: ({name, format = 'webp'}) => Promise.resolve({
    fileName: `${name ?? 'gallery-default'}.${format}`,
    format,
    width: 2,
    height: 1,
    bytes: 3,
    dump: null,
  }),
  getAim: () => ({
    origin: {
      x: 0,
      y: 1,
      z: 2,
    },
    direction: {
      x: 0,
      y: 0,
      z: -1,
    },
    hit: null,
    hits: [],
  }),
  endWarmup: () => Promise.resolve({
    warmed: true,
    width: 3840,
    height: 2160,
  }),
  getLoadingItems: () => ['pipeline:lobby-floor/MeshStandardNodeMaterial', 'warmup'],
  getKnots: () => [{
    id: 'example_knot',
    name: 'Example Knot',
    position: [1, 2, 3],
    rarity: 2,
  }],
  getPortraitSlots: () => [{
    id: 'lobby-north-0',
    wallId: 'lobby-north',
    ratio: '2:3',
    priority: 0,
    width: 1.6,
    height: 2.4,
    position: [-3.6, 2.55, -31.78],
    rotation: 0,
  }],
  getTelemetry: () => null,
  setWireframe: ({enabled = false, direction = 'in', mode = 'triangle', anchor = 'nearest', shape = 'sphere', position = [0, 0, 0], radius = 0, highlight = [], color = null, highlightColor = null, seamWidth = null, glowDuration = 1, seamColor = null, seamIntensity = 0.9, angleIndicatorStrength = 5, speed = null, burst = 1, burstDuration = 0.5, antialiasing = false, lineStyle = 'barycentric', lineWidth = 0.5}) => ({
    enabled,
    direction,
    mode,
    anchor,
    shape,
    position,
    radius,
    highlight,
    color,
    highlightColor,
    seamWidth,
    glowDuration,
    seamColor,
    seamIntensity,
    angleIndicatorStrength,
    speed,
    burst,
    burstDuration,
    antialiasing,
    lineStyle,
    lineWidth,
  }),
  throwProp: ({prop, from = [0, 1.5, 0], velocity = [0, 0, -10]}: PropThrowInput) => ({
    prop,
    from,
    velocity,
  }),
}
test('WebMCP read tools are read-only, validate input and read the current bridge', () => {
  let current = bridge
  const tools = createWebmcpTools(() => current)
  const controller = new AbortController
  expect(tools.map(tool => tool.name)).toEqual(['get_aim', 'get_telemetry', 'dump_knots', 'dump_portrait_slots', 'analyze_world', 'get_loading_items', 'download_frame', 'end_warmup', 'throw_prop', 'set_wireframe'])
  for (const tool of tools.slice(0, 6)) {
    expect(tool.annotations?.readOnlyHint).toBe(true)
    expect(() => tool.execute({unexpected: true}, {signal: controller.signal})).toThrow(TypeError)
  }
  expect(tools[0].execute({}, {signal: controller.signal})).toEqual(bridge.getAim())
  current = {
    ...bridge,
    getAim: () => ({
      ...bridge.getAim(),
      origin: {
        x: 3,
        y: 4,
        z: 5,
      },
    }),
  }
  expect(tools[0].execute({}, {signal: controller.signal})).toEqual(current.getAim())
  expect(tools[1].execute({}, {signal: controller.signal})).toBeNull()
  expect(tools[2].execute({}, {signal: controller.signal})).toEqual(current.getKnots())
  expect(tools[3].execute({}, {signal: controller.signal})).toEqual(current.getPortraitSlots())
  expect(tools[4].execute({}, {signal: controller.signal})).toEqual(current.analyzeWorld())
  expect(tools[5].execute({}, {signal: controller.signal})).toBe('pipeline:lobby-floor/MeshStandardNodeMaterial\nwarmup')
  controller.abort()
  expect(() => tools[0].execute({}, {signal: controller.signal})).toThrow()
})
test('download_frame validates its optional name and downloads through the bridge', async () => {
  const tool = createWebmcpTools(() => bridge).find(({name}) => name === 'download_frame')!
  const controller = new AbortController
  const execute = (input: unknown) => tool.execute(input as Record<string, unknown>, {signal: controller.signal}) as Promise<unknown>
  expect(tool.annotations?.readOnlyHint).toBe(false)
  expect(await execute({})).toEqual({
    fileName: 'gallery-default.webp',
    format: 'webp',
    width: 2,
    height: 1,
    bytes: 3,
    dump: null,
  })
  expect(await execute({name: 'lobby-2026.10'})).toHaveProperty('fileName', 'lobby-2026.10.webp')
  expect(await execute({
    name: 'shot',
    format: 'png',
  })).toHaveProperty('fileName', 'shot.png')
  for (const input of [null, [], {unexpected: true}, {name: ''}, {name: '../escape'}, {name: 'a b'}, {name: 5}, {format: 'jxl'}]) {
    await expect(execute(input)).rejects.toThrow(TypeError)
  }
  controller.abort()
  await expect(execute({})).rejects.toThrow()
})
test('end_warmup takes no input and ends the warmup through the bridge', async () => {
  const tool = createWebmcpTools(() => bridge).find(({name}) => name === 'end_warmup')!
  const controller = new AbortController
  const execute = (input: unknown) => Promise.try(() => tool.execute(input as Record<string, unknown>, {signal: controller.signal}))
  expect(tool.annotations?.readOnlyHint).toBe(false)
  expect(await execute({})).toEqual({
    warmed: true,
    width: 3840,
    height: 2160,
  })
  for (const input of [null, [], {scale: 1}]) {
    await expect(execute(input)).rejects.toThrow(TypeError)
  }
  controller.abort()
  await expect(execute({})).rejects.toThrow()
})
test('set_wireframe validates its optional fields and sets them through the bridge', () => {
  const tool = createWebmcpTools(() => bridge).find(({name}) => name === 'set_wireframe')!
  const controller = new AbortController
  const execute = (input: unknown) => tool.execute(input as Record<string, unknown>, {signal: controller.signal})
  expect(tool.annotations?.readOnlyHint).toBe(false)
  expect(execute({
    enabled: true,
    direction: 'out',
    position: [0, 0.5, -12],
    radius: 2,
    highlight: ' lobby-fountain / fountain-falling-water ',
    color: '#f00',
    highlight_color: '#2F7BFF',
    mode: 'pixel',
    anchor: 'farthest',
    shape: 'circle',
    seam_width: 0.3,
    glow_duration: 0.5,
    seam_color: '#fff',
    seam_intensity: 0,
    angle_indicator_strength: 25,
    speed: 8,
    burst: 4,
    burst_duration: 0.25,
    antialiasing: true,
    line_style: 'barycentric',
    line_width: 1.5,
  })).toEqual({
    enabled: true,
    direction: 'out',
    mode: 'pixel',
    anchor: 'farthest',
    shape: 'circle',
    position: [0, 0.5, -12],
    radius: 2,
    highlight: ['lobby-fountain/fountain-falling-water'],
    color: '#f00',
    highlight_color: '#2F7BFF',
    seam_width: 0.3,
    glow_duration: 0.5,
    seam_color: '#fff',
    seam_intensity: 0,
    angle_indicator_strength: 25,
    speed: 8,
    burst: 4,
    burst_duration: 0.25,
    antialiasing: true,
    line_style: 'barycentric',
    line_width: 1.5,
  })
  expect(execute({highlight: ['a', 'b/c']})).toHaveProperty('highlight', ['a', 'b/c'])
  expect(execute({mode: 'combined'})).toHaveProperty('mode', 'combined')
  expect(execute({})).toEqual({
    enabled: false,
    direction: 'in',
    mode: 'triangle',
    anchor: 'nearest',
    shape: 'sphere',
    position: [0, 0, 0],
    radius: 0,
    highlight: [],
    color: null,
    highlight_color: null,
    seam_width: null,
    glow_duration: 1,
    seam_color: null,
    seam_intensity: 0.9,
    angle_indicator_strength: 5,
    speed: null,
    burst: 1,
    burst_duration: 0.5,
    antialiasing: false,
    line_style: 'barycentric',
    line_width: 0.5,
  })
  for (const input of [null, [], {unexpected: true}, {enabled: 1}, {position: [1, 2]}, {position: [1, 2, Number.NaN]}, {position: '0,0,0'}, {radius: -1}, {radius: '2'}, {radius: Number.POSITIVE_INFINITY}, {highlight: ''}, {highlight: [' / ']}, {highlight: 5}, {color: 'red'}, {color: '#12345'}, {highlight_color: 3}, {mode: 'edge'}, {anchor: 'middle'}, {shape: 'cube'}, {seam_width: 0}, {seam_width: '1'}, {seam_color: 'blue'}, {seam_intensity: -1}, {glow_duration: -0.1}, {glow_duration: Number.NaN}, {seam_intensity: null}, {angle_indicator_strength: 101}, {angle_indicator_strength: -1}, {angle_indicator_strength: '10'}, {speed: -1}, {speed: '8'}, {burst: -0.5}, {burst: null}, {burst_duration: 0}, {antialiasing: 1}, {line_style: 'dashed'}, {line_width: 0}, {direction: 'up'}, {direction: true}]) {
    expect(() => execute(input)).toThrow(TypeError)
  }
  controller.abort()
  expect(() => execute({})).toThrow()
})
test('throw_prop takes a prop and exactly one of a portrait, a target or a velocity, and throws through the bridge', () => {
  const tool = createWebmcpTools(() => bridge).find(({name}) => name === 'throw_prop')!
  const controller = new AbortController
  const execute = (input: unknown) => tool.execute(input as Record<string, unknown>, {signal: controller.signal})
  expect(tool.annotations?.readOnlyHint).toBe(false)
  expect(execute({
    prop: 'prop-orb-spook',
    velocity: [1, 2, 3],
    from: [4, 5, 6],
  })).toEqual({
    prop: 'prop-orb-spook',
    from: [4, 5, 6],
    velocity: [1, 2, 3],
  })
  expect(execute({
    prop: 'prop-orb-spook',
    portrait: 'goose',
    speed: 8,
  })).toHaveProperty('prop', 'prop-orb-spook')
  for (const input of [null, [], {}, {prop: ''}, {prop: 'prop-orb-spook'}, {
    prop: 'prop-orb-spook',
    portrait: 'goose',
    target: [0, 0, 0],
  }, {
    prop: 'prop-orb-spook',
    target: [0, 0],
  }, {
    prop: 'prop-orb-spook',
    velocity: [0, 0, Number.NaN],
  }, {
    prop: 'prop-orb-spook',
    portrait: '',
  }, {
    prop: 'prop-orb-spook',
    portrait: 'goose',
    speed: 0,
  }, {
    prop: 'prop-orb-spook',
    portrait: 'goose',
    from: '0,0,0',
  }, {
    prop: 'prop-orb-spook',
    portrait: 'goose',
    spin: [0, 0, 0],
  }]) {
    expect(() => execute(input)).toThrow(TypeError)
  }
  controller.abort()
  expect(() => execute({
    prop: 'prop-orb-spook',
    portrait: 'goose',
  })).toThrow()
})
test('worlds without Knots expose an empty dump', () => {
  expect(slopGallery.dumpKnots()).toEqual([])
})
test('registrations clean up on unmount, failure and cancellation during registration', async () => {
  for (const mode of ['success', 'failure', 'abort'] as const) {
    const controller = new AbortController
    const signals: Array<AbortSignal> = []
    const context = {
      registerTool: async (_tool: WebMCP.ModelContextTool, options: WebMCP.ModelContextRegisterToolOptions) => {
        signals.push(options.signal!)
        if (signals.length === 2 && mode === 'failure') {
          throw new Error('Registration failed')
        }
        if (mode === 'abort') {
          controller.abort()
        }
      },
    } as WebMCP.ModelContext
    const registered = registerWebmcp(() => bridge, controller.signal, context)
    if (mode === 'success') {
      const cleanup = await registered
      expect(signals).toHaveLength(10)
      expect(signals[0].aborted).toBe(false)
      cleanup()
      cleanup()
    } else {
      await expect(registered).rejects.toThrow()
    }
    expect(signals.every(signal => signal.aborted)).toBe(true)
  }
})
test('an already aborted mount never registers tools', async () => {
  const controller = new AbortController
  controller.abort()
  const cleanup = await registerWebmcp(() => bridge, controller.signal, {
    registerTool: () => {
      throw new Error('Must not register')
    },
  } as unknown as WebMCP.ModelContext)
  expect(cleanup).toBeFunction()
})
