import type {PortraitAdditionInput} from '../../src/lib/webmcp/addPortrait.ts'
import type {MoodCastInput} from '../../src/lib/webmcp/castMood.ts'
import type {SeedInput} from '../../src/lib/webmcp/changeSeed.ts'
import type {GeofenceQuery} from '../../src/lib/webmcp/getGeofences.ts'
import type {GraphicsQualityInput} from '../../src/lib/webmcp/setGraphicsQuality.ts'
import type {OrbSpawnInput} from '../../src/lib/webmcp/spawnOrb.ts'
import type {PartyEffectSpawnInput} from '../../src/lib/webmcp/spawnPartyEffect.ts'
import type {PropThrowInput} from '../../src/lib/webmcp/throwProp.ts'
import type {WebmcpBridge} from '../../src/lib/webmcp/tools.ts'

import {expect, test} from 'bun:test'

import {useFenceDisplay} from '../../src/lib/gallery/fenceDisplay.ts'
import registerWebmcp from '../../src/lib/webmcp/register.ts'
import showFence from '../../src/lib/webmcp/showFence.ts'
import createWebmcpTools from '../../src/lib/webmcp/tools.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

/** what the bridge got as the target, which the real one resolves to a slot or a wall */
type EchoedAddition = Awaited<ReturnType<WebmcpBridge['addPortrait']>> & Pick<PortraitAdditionInput, 'target'>

const bridge: WebmcpBridge = {
  showFence,
  addPortrait: ({id = 'work-1', frame, size = 30_000, target, title = 'xf14RxM8'}: PortraitAdditionInput) => Promise.resolve<EchoedAddition>({
    id,
    title,
    hung: !('position' in target) || 'wallId' in target,
    target,
    ...frame === 'louis' ? {frame} : {},
    position: [10.2, 3.13, 7.78],
    rotation: Math.PI,
    width: 1.732,
    height: 1.732,
    size,
  }),
  analyzeWorld: () => ({
    rooms: {},
    elsewhere: {
      meshes: [],
      items: [],
      lights: [],
    },
    globalLights: [],
  }),
  castMood: ({mood}: MoodCastInput) => (mood === null ? {mood} : {
    mood,
    title: 'Atelier',
    fade: {
      in: 3.5,
      out: 1,
    },
  }),
  downloadFrame: ({name, format = 'webp'}) => Promise.resolve({
    fileName: `${name ?? 'gallery-default'}.${format}`,
    format,
    width: 2,
    height: 1,
    bytes: 3,
    dump: null,
  }),
  dumpGeofences: () => [{
    id: 'lobby',
    boxes: [{
      x: -8,
      z: -32,
      x2: 8,
      z2: 8,
      floor: -0.2,
    }],
  }, {
    id: 'moonfall',
    boxes: [{
      x: -22,
      z: 4.5,
      x2: 6,
      z2: 32.5,
      ceiling: -2,
    }, {
      x: 4,
      z: 10.7,
      x2: 19.15,
      z2: 21,
    }],
  }],
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
  // the player stands in the Lobby, and every position asked about lies on its wall to the Vesper
  getGeofences: ({position}: GeofenceQuery) => (position ? ['lobby', 'vesper'] : ['lobby']),
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
  rerollSeed: () => ({
    via: 'storage',
    previous: 7,
    seed: null,
  }),
  setSeed: ({seed}: SeedInput) => ({
    via: 'url',
    url: `https://slop.gallery/?seed=${seed}`,
    previous: 7,
    seed,
  }),
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
  getPortraits: () => [{
    id: 'gnomes',
    title: 'The Night Watering',
    hung: true,
    wallId: 'banquet-south',
    width: 2.121,
    height: 1.414,
    position: [14, 3.13, 7.78],
    quaternion: [0, 1, 0, 0],
  }],
  setGraphicsQuality: ({quality}: GraphicsQualityInput) => Promise.resolve({
    quality: quality === 'heavy' ? 'heavy' : 'fast',
    previous: 'fast',
    initial: 'fast',
  }),
  spawnOrb: ({orb, position, id = `prop-orb-${orb}-spawned-1`}: OrbSpawnInput) => Promise.resolve({
    prop: id,
    orb,
    position,
  }),
  spawnPartyEffect: ({effect, position, rotation = 0, floor = 0}: PartyEffectSpawnInput) => ({
    effect,
    position,
    rotation,
    floor,
    duration: 2.5,
  }),
}
test('WebMCP read tools are read-only, validate input and read the current bridge', () => {
  let current = bridge
  const tools = createWebmcpTools(() => current)
  const controller = new AbortController
  expect(tools.map(tool => tool.name)).toEqual(['get_aim', 'get_telemetry', 'dump_knots', 'dump_portrait_slots', 'dump_portraits', 'dump_geofences', 'analyze_world', 'get_loading_items', 'get_geofences', 'show_fence', 'download_frame', 'end_warmup', 'throw_prop', 'spawn_orb', 'spawn_party_effect', 'cast_mood', 'set_graphics_quality', 'reroll_seed', 'set_seed', 'add_portrait', 'set_wireframe'])
  for (const tool of tools.slice(0, 8)) {
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
  expect(tools[4].execute({}, {signal: controller.signal})).toEqual(current.getPortraits())
  expect(tools[5].execute({}, {signal: controller.signal})).toEqual(current.dumpGeofences())
  expect(tools[6].execute({}, {signal: controller.signal})).toEqual(current.analyzeWorld())
  expect(tools[7].execute({}, {signal: controller.signal})).toBe('pipeline:lobby-floor/MeshStandardNodeMaterial\nwarmup')
  controller.abort()
  expect(() => tools[0].execute({}, {signal: controller.signal})).toThrow()
})
test('get_geofences is read-only, takes an optional position of x, y and z and asks the bridge', () => {
  const queries: Array<GeofenceQuery> = []
  const tool = createWebmcpTools(() => ({
    ...bridge,
    getGeofences(query) {
      queries.push(query)
      return bridge.getGeofences(query)
    },
  })).find(({name}) => name === 'get_geofences')!
  const controller = new AbortController
  const execute = (input: unknown) => tool.execute(input as Record<string, unknown>, {signal: controller.signal})
  const position = {
    x: -8,
    y: 1.5,
    z: 0,
  }
  expect(tool.annotations?.readOnlyHint).toBe(true)
  expect(execute({})).toEqual(['lobby'])
  expect(execute({position})).toEqual(['lobby', 'vesper'])
  expect(queries).toEqual([{position: undefined}, {position}])
  for (const input of [null, [], 'lobby', {unexpected: true}, {
    position,
    room: 'lobby',
  }, {position: null}, {position: [-8, 1.5, 0]}, {position: {
    x: -8,
    z: 0,
  }}, {position: {
    ...position,
    w: 1,
  }}, {position: {
    ...position,
    y: Number.NaN,
  }}, {position: {
    ...position,
    y: '1.5',
  }}]) {
    expect(() => execute(input)).toThrow(TypeError)
  }
  expect(queries).toHaveLength(2)
  controller.abort()
  expect(() => execute({})).toThrow()
})
test('show_fence selects all, one or no fences and preserves the selection on errors', () => {
  const tool = createWebmcpTools(() => bridge).find(({name}) => name === 'show_fence')!
  const controller = new AbortController
  const execute = (input: Record<string, unknown>) => tool.execute(input, {signal: controller.signal})
  const original = useFenceDisplay.getState()
  try {
    expect(tool.annotations?.readOnlyHint).toBe(false)
    expect(execute({})).toEqual({fence: true})
    expect(useFenceDisplay.getState().fence).toBe(true)
    expect(execute({fence: 'lobby_north'})).toEqual({fence: 'lobby_north'})
    for (const input of [{fence: 'unknown'}, {fence: ''}, {fence: 7}, {unknown: true}]) {
      expect(() => execute(input)).toThrow()
    }
    expect(useFenceDisplay.getState().fence).toBe('lobby_north')
    expect(execute({fence: false})).toEqual({fence: false})
    controller.abort()
    expect(() => execute({})).toThrow()
    expect(useFenceDisplay.getState().fence).toBe(false)
  } finally {
    useFenceDisplay.setState(original)
  }
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
test('spawn_orb takes a kind, a point and an optional prop id, and spawns through the bridge', async () => {
  const tool = createWebmcpTools(() => bridge).find(({name}) => name === 'spawn_orb')!
  const controller = new AbortController
  const execute = (input: unknown) => Promise.try(() => tool.execute(input as Record<string, unknown>, {signal: controller.signal}))
  expect(tool.annotations?.readOnlyHint).toBe(false)
  expect(await execute({
    orb: 'horror',
    position: [1, 0.2, 3],
  })).toEqual({
    prop: 'prop-orb-horror-spawned-1',
    orb: 'horror',
    position: [1, 0.2, 3],
  })
  expect(await execute({
    orb: 'horror',
    position: [1, 0.2, 3],
    id: 'prop-orb-horror-film',
  })).toHaveProperty('prop', 'prop-orb-horror-film')
  for (const input of [null, [], {}, {orb: 'horror'}, {position: [0, 0, 0]}, {
    orb: '',
    position: [0, 0, 0],
  }, {
    orb: 'horror',
    position: [0, 0],
  }, {
    orb: 'horror',
    position: [0, 0, Number.NaN],
  }, {
    orb: 'horror',
    position: [0, 0, 0],
    id: 'orb-horror',
  }, {
    orb: 'horror',
    position: [0, 0, 0],
    id: 'prop-a b',
  }, {
    orb: 'horror',
    position: [0, 0, 0],
    velocity: [0, 0, 0],
  }]) {
    await expect(execute(input)).rejects.toThrow(TypeError)
  }
  controller.abort()
  await expect(execute({
    orb: 'horror',
    position: [0, 0, 0],
  })).rejects.toThrow()
})
test('spawn_party_effect takes an effect, a point and an optional rotation, floor and delay, and spawns through the bridge', async () => {
  const tool = createWebmcpTools(() => bridge).find(({name}) => name === 'spawn_party_effect')!
  const controller = new AbortController
  const execute = (input: unknown) => Promise.try(() => tool.execute(input as Record<string, unknown>, {signal: controller.signal}))
  expect(tool.annotations?.readOnlyHint).toBe(false)
  expect(await execute({
    effect: 'blood',
    position: [1, 1.8, 3],
  })).toEqual({
    effect: 'blood',
    position: [1, 1.8, 3],
    rotation: 0,
    floor: 0,
    duration: 2.5,
  })
  expect(await execute({
    effect: 'bats',
    position: [1, 1.8, 3],
    rotation: Math.PI / 2,
    floor: -4,
    delay: 0.5,
  })).toEqual({
    effect: 'bats',
    position: [1, 1.8, 3],
    rotation: Math.PI / 2,
    floor: -4,
    duration: 2.5,
  })
  for (const input of [null, [], {}, {effect: 'blood'}, {position: [0, 0, 0]}, {
    effect: '',
    position: [0, 0, 0],
  }, {
    effect: 'blood',
    position: [0, 0],
  }, {
    effect: 'blood',
    position: [0, 0, Number.NaN],
  }, {
    effect: 'blood',
    position: [0, 0, 0],
    rotation: 'north',
  }, {
    effect: 'blood',
    position: [0, 0, 0],
    floor: Number.POSITIVE_INFINITY,
  }, {
    effect: 'blood',
    position: [0, 0, 0],
    delay: -1,
  }, {
    effect: 'blood',
    position: [0, 0, 0],
    orientation: [0, 0, 0, 1],
  }]) {
    await expect(execute(input)).rejects.toThrow(TypeError)
  }
  controller.abort()
  await expect(execute({
    effect: 'blood',
    position: [0, 0, 0],
  })).rejects.toThrow()
})
test('cast_mood takes the id of a mood or null and casts through the bridge', async () => {
  const tool = createWebmcpTools(() => bridge).find(({name}) => name === 'cast_mood')!
  const controller = new AbortController
  const execute = (input: unknown) => Promise.try(() => tool.execute(input as Record<string, unknown>, {signal: controller.signal}))
  expect(tool.annotations?.readOnlyHint).toBe(false)
  expect(await execute({mood: 'paint'})).toEqual({
    mood: 'paint',
    title: 'Atelier',
    fade: {
      in: 3.5,
      out: 1,
    },
  })
  expect(await execute({mood: null})).toEqual({mood: null})
  for (const input of [null, [], {}, {mood: ''}, {mood: 3}, {mood: undefined}, {
    mood: 'paint',
    fade: 2,
  }]) {
    await expect(execute(input)).rejects.toThrow(TypeError)
  }
  controller.abort()
  await expect(execute({mood: 'paint'})).rejects.toThrow()
})
test('set_graphics_quality takes the name of the graphics or null and switches through the bridge', async () => {
  const tool = createWebmcpTools(() => bridge).find(({name}) => name === 'set_graphics_quality')!
  const controller = new AbortController
  const execute = (input: unknown) => Promise.try(() => tool.execute(input as Record<string, unknown>, {signal: controller.signal}))
  expect(tool.annotations?.readOnlyHint).toBe(false)
  expect(await execute({quality: 'heavy'})).toEqual({
    quality: 'heavy',
    previous: 'fast',
    initial: 'fast',
  })
  expect(await execute({quality: null})).toEqual({
    quality: 'fast',
    previous: 'fast',
    initial: 'fast',
  })
  for (const input of [null, [], {}, {quality: ''}, {quality: 3}, {quality: undefined}, {
    quality: 'heavy',
    scale: 2,
  }]) {
    await expect(execute(input)).rejects.toThrow(TypeError)
  }
  controller.abort()
  await expect(execute({quality: 'heavy'})).rejects.toThrow()
})
test('reroll_seed takes an empty input object and rerolls through the bridge', async () => {
  const tool = createWebmcpTools(() => bridge).find(({name}) => name === 'reroll_seed')!
  const controller = new AbortController
  const execute = (input: unknown) => Promise.try(() => tool.execute(input as Record<string, unknown>, {signal: controller.signal}))
  expect(tool.annotations?.readOnlyHint).toBe(false)
  expect(await execute({})).toEqual(bridge.rerollSeed())
  for (const input of [null, [], {seed: 1}]) {
    await expect(execute(input)).rejects.toThrow(TypeError)
  }
  controller.abort()
  await expect(execute({})).rejects.toThrow()
})
test('set_seed takes an unsigned 32-bit integer and sets it through the bridge', async () => {
  const tool = createWebmcpTools(() => bridge).find(({name}) => name === 'set_seed')!
  const controller = new AbortController
  const execute = (input: unknown) => Promise.try(() => tool.execute(input as Record<string, unknown>, {signal: controller.signal}))
  expect(tool.annotations?.readOnlyHint).toBe(false)
  for (const seed of [0, 42, 0xFF_FF_FF_FF]) {
    expect(await execute({seed})).toEqual(bridge.setSeed({seed}))
  }
  for (const input of [null, [], {}, {seed: -1}, {seed: 1.5}, {seed: 2 ** 32}, {seed: '42'}, {seed: Number.NaN}, {seed: undefined}, {
    seed: 1,
    reload: true,
  }]) {
    await expect(execute(input)).rejects.toThrow(TypeError)
  }
  controller.abort()
  await expect(execute({seed: 1})).rejects.toThrow()
})
test('add_portrait takes an image URL, exactly one kind of target and an optional title, id, frame and size, and adds through the bridge', async () => {
  const tool = createWebmcpTools(() => bridge).find(({name}) => name === 'add_portrait')!
  const controller = new AbortController
  const execute = (input: unknown) => Promise.try(() => tool.execute(input as Record<string, unknown>, {signal: controller.signal}))
  const image = 'http://127.0.0.1:8080/xf14RxM8.png'
  const slot = {slot: 'banquet-south_2'}
  expect(tool.annotations?.readOnlyHint).toBe(false)
  expect(await execute({
    image,
    target: slot,
  })).toEqual({
    id: 'work-1',
    title: 'xf14RxM8',
    hung: true,
    target: slot,
    position: [10.2, 3.13, 7.78],
    rotation: Math.PI,
    width: 1.732,
    height: 1.732,
    size: 30_000,
  })
  // The wall’s id arrives as the bridge names it.
  expect(await execute({
    image,
    target: {
      wall_id: 'banquet-south',
      position: {
        x: -1.5,
        y: 2,
      },
    },
  })).toHaveProperty('target', {
    wallId: 'banquet-south',
    position: {
      x: -1.5,
      y: 2,
    },
  })
  const loose = {position: {
    x: 0,
    y: 1.5,
    z: -9,
  }}
  expect(await execute({
    image,
    target: loose,
  })).toMatchObject({
    target: loose,
    hung: false,
  })
  expect(await execute({
    image,
    target: slot,
    title: 'Invader',
    id: 'film-invader',
    frame: 'louis',
    size: 7500,
  })).toMatchObject({
    title: 'Invader',
    id: 'film-invader',
    frame: 'louis',
    size: 7500,
  })
  const targets: Array<unknown> = [undefined, null, 'banquet-south_2', [], {}, {slot: ''}, {slot: 3}, {
    slot: 'banquet-south_2',
    wall_id: 'banquet-south',
  }, {
    slot: 'banquet-south_2',
    position: loose.position,
  }, {wall_id: 'banquet-south'}, {
    wall_id: 'banquet-south',
    position: loose.position,
  }, {
    wall_id: 'banquet-south',
    position: [0, 2],
  }, {
    wall_id: '',
    position: {
      x: 0,
      y: 2,
    },
  }, {position: {
    x: 0,
    y: 2,
  }}, {position: [0, 1.5, -9]}, {position: {
    x: 0,
    y: Number.NaN,
    z: -9,
  }}, {position: {
    x: 0,
    y: '1.5',
    z: -9,
  }}, {
    position: loose.position,
    rotation: 0,
  }]
  for (const input of [null, [], {}, {target: slot}, {image}, {
    image,
    slot: 'banquet-south_2',
  }, {
    image: 'not a url',
    target: slot,
  }, {
    image,
    target: slot,
    id: 'no spaces',
  }, {
    image,
    target: slot,
    title: ' ',
  }, {
    image,
    target: slot,
    title: 'x'.repeat(151),
  }, {
    image,
    target: slot,
    frame: '',
  }, {
    image,
    target: slot,
    frame: 3,
  }, ...[0, -7500, Infinity, '7500'].map(size => ({
    image,
    target: slot,
    size,
  })), {
    image,
    target: slot,
    rotation: 0,
  }, ...targets.map(target => ({
    image,
    target,
  }))]) {
    await expect(execute(input)).rejects.toThrow(TypeError)
  }
  controller.abort()
  await expect(execute({
    image,
    target: slot,
  })).rejects.toThrow()
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
      expect(signals).toHaveLength(createWebmcpTools(() => bridge).length)
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
