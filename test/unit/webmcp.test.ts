import type {PortraitAdditionInput} from '../../src/lib/webmcp/addPortrait.ts'
import type {MoodCastInput} from '../../src/lib/webmcp/castMood.ts'
import type {SeedInput} from '../../src/lib/webmcp/changeSeed.ts'
import type {GeofenceQuery} from '../../src/lib/webmcp/getGeofences.ts'
import type {SloperatorSightingInput, SloperatorSpawnInput} from '../../src/lib/webmcp/sloperator.ts'
import type {OrbSpawnInput} from '../../src/lib/webmcp/spawnOrb.ts'
import type {PartyEffectSpawnInput} from '../../src/lib/webmcp/spawnPartyEffect.ts'
import type {PropThrowInput} from '../../src/lib/webmcp/throwProp.ts'
import type {WebmcpBridge} from '../../src/lib/webmcp/tools.ts'
import type {WorldTuningInput} from '../../src/lib/webmcp/worldTuning.ts'

import {expect, test} from 'bun:test'

import {canvasMaterialIds} from '../../src/canvas_materials/lib/canvasMaterialIds.ts'
import {useFenceDisplay} from '../../src/lib/gallery/fenceDisplay.ts'
import {showColliders, useColliderDisplay} from '../../src/lib/physics/colliderDisplay.ts'
import registerWebmcp from '../../src/lib/webmcp/register.ts'
import showFence from '../../src/lib/webmcp/showFence.ts'
import {dumpSloperator, provideSloperator, spawnSloperator, triggerSloperatorSighting} from '../../src/lib/webmcp/sloperator.ts'
import createWebmcpTools from '../../src/lib/webmcp/tools.ts'

/** what the bridge got as the target, which the real one resolves to a slot or a wall */
type EchoedAddition = Awaited<ReturnType<WebmcpBridge['addPortrait']>> & Pick<PortraitAdditionInput, 'hangingAnimation' | 'target'>

const bridge: WebmcpBridge = {
  addTextOverlay: () => ({added: true}),
  clearTextOverlay: () => 2,
  addLayer: layer => layer.id,
  clearLayer: () => 1,
  clearDrawings: () => 2,
  addDrawing: drawing => ({
    id: 'test',
    drawing,
  }),
  showColliders,
  showFence,
  addPortrait: ({canvasMaterial, hangingAnimation, id = 'work-1', frame, size = 30_000, target, title = 'xf14RxM8'}: PortraitAdditionInput) => Promise.resolve<EchoedAddition>({
    id,
    title,
    hung: !('position' in target) || 'wallId' in target,
    target,
    ...hangingAnimation === undefined ? {} : {hangingAnimation},
    ...frame === 'louis' ? {frame} : {},
    ...canvasMaterial === 'linen' ? {canvasMaterial} : {},
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
  dumpSloperator: () => [{
    fence: 'salon',
    id: 'lobby_east_bench',
    pinned: false,
    position: [4.06, 0, -11],
    sighted: false,
    state: 'standing',
    yaw: -Math.PI / 2,
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
  getWorldTuning: () => ({
    development: true,
    open: false,
    modules: [{
      id: 'view',
      title: 'View',
      shown: true,
      controls: [{
        key: 'fov',
        group: 'View',
        label: 'Field of view',
        kind: 'range',
        value: 65,
        min: 5,
        max: 120,
        step: 1,
        unit: '°',
      }],
    }],
  }),
  setWorldTuning: ({values}: WorldTuningInput) => ({changes: Object.entries(values).flatMap(([module, moduleValues]) => Object.entries(moduleValues).map(([key, to]) => ({
    module,
    key,
    from: 65,
    to: to as number,
  })))}),
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
  setWireframe: ({enabled = false, direction = 'in', mode = 'triangle', anchor = 'nearest', shape = 'sphere', position = [0, 0, 0], radius = 0, highlight = null, color = null, highlightColor = null, background = null, seamWidth = null, glowDuration = 1, seamColor = null, seamIntensity = 0.9, angleIndicatorStrength = 0, speed = null, burst = 1, burstDuration = 0.5, antialiasing = false, lineStyle = 'barycentric', lineWidth = 0.5}) => ({
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
    background,
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
  // the player stands in the Salon, the fence of the east fountain bench, where he is drawn
  spawnSloperator: ({sight = 'lobby_east_bench'}: SloperatorSpawnInput) => Promise.resolve([{
    detection: 'present',
    fence: 'salon',
    id: sight,
    pinned: true,
    pose: 'sit',
    position: [4.06, 0, -11],
    sighted: false,
    state: 'seated',
    yaw: -Math.PI / 2,
  }]),
  triggerSloperatorSighting: ({sight = 'lobby_east_bench'}: SloperatorSightingInput) => [{
    distance: 9.5,
    pose: 'sit',
    position: [9, 1.6, -27],
    sight,
  }],
}
const galleryTools = createWebmcpTools(bridge)
const toolNamed = (name: string) => galleryTools.find(tool => tool.name === name)!
test('read-only snapshots take empty input and read from the mounted world', () => {
  const controller = new AbortController
  const options = {signal: controller.signal}
  const snapshots = {
    get_aim: bridge.getAim(),
    get_telemetry: bridge.getTelemetry(),
    dump_knots: bridge.getKnots(),
    dump_portrait_slots: bridge.getPortraitSlots(),
    dump_portraits: bridge.getPortraits(),
    dump_geofences: bridge.dumpGeofences(),
    dump_sloperator: bridge.dumpSloperator(),
    analyze_world: bridge.analyzeWorld(),
    get_loading_items: bridge.getLoadingItems().join('\n'),
    get_world_tuning: bridge.getWorldTuning(),
  }
  for (const [name, expected] of Object.entries(snapshots)) {
    const tool = toolNamed(name)
    expect(tool.annotations?.readOnlyHint, name).toBe(true)
    expect(() => tool.execute({unexpected: true}, options), name).toThrow(TypeError)
    expect(tool.execute({}, options), name).toEqual(expected)
  }
  controller.abort()
  expect(() => toolNamed('get_aim').execute({}, options)).toThrow()
})
test('set_world_tuning takes values by module and key, null among them, and asks the bridge', () => {
  const inputs: Array<WorldTuningInput> = []
  const tool = createWebmcpTools({
    ...bridge,
    setWorldTuning(input) {
      inputs.push(input)
      return bridge.setWorldTuning(input)
    },
  }).find(({name}) => name === 'set_world_tuning')!
  const controller = new AbortController
  const execute = (input: unknown) => tool.execute(input as Record<string, unknown>, {signal: controller.signal})
  expect(tool.annotations?.readOnlyHint).toBe(false)
  expect(execute({values: {view: {fov: 50}}})).toEqual({changes: [{
    module: 'view',
    key: 'fov',
    from: 65,
    to: 50,
  }]})
  execute({values: {view: {fov: null}}})
  execute({values: {studio: {lightColor: {lightness: 100}}}})
  expect(inputs).toEqual([{values: {view: {fov: 50}}}, {values: {view: {fov: null}}}, {values: {studio: {lightColor: {lightness: 100}}}}])
  for (const input of [null, {}, {values: null}, {values: {view: 50}}, {values: {view: [50]}}, {
    values: [],
    extra: true,
  }, {
    values: {view: {fov: 50}},
    module: 'view',
  }]) {
    expect(() => execute(input)).toThrow(TypeError)
  }
  expect(inputs).toHaveLength(3)
})
test('get_geofences is read-only, takes an optional position of x, y and z and asks the bridge', () => {
  const queries: Array<GeofenceQuery> = []
  const tool = createWebmcpTools({
    ...bridge,
    getGeofences(query) {
      queries.push(query)
      return bridge.getGeofences(query)
    },
  }).find(({name}) => name === 'get_geofences')!
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
test('add_drawing validates the chosen shape before adding it to the overlay', () => {
  const tool = toolNamed('add_drawing')
  const controller = new AbortController
  const options = {signal: controller.signal}
  const drawing = {
    type: 'line',
    from: [0, 1, 2],
    to: [3, 4, 5],
    color: '#00ffff',
  }
  expect(tool.execute(drawing, options)).toEqual({
    id: 'test',
    drawing,
  })
  for (const invalid of [{
    ...drawing,
    to: [0, NaN, 0],
  }, {
    ...drawing,
    radius: 1,
  }, {
    type: 'circle',
    center: [0, 0, 0],
    radius: -1,
  }, {type: 'point'}]) {
    expect(() => tool.execute(invalid, options)).toThrow(TypeError)
  }
})
test('WebMCP layer calls reject malformed inputs before creating or clearing layers', () => {
  const controller = new AbortController
  const run = (name: string, input: Record<string, unknown>) => toolNamed(name).execute(input, {signal: controller.signal})
  expect(run('add_layer', {id: 'notes'})).toEqual({id: 'notes'})
  expect(run('clear_layer', {id: 'notes'})).toEqual({removed: 1})
  expect(run('clear_drawings', {})).toEqual({removed: 2})
  expect(() => run('clear_drawings', {id: 'notes'})).toThrow()
  expect(() => run('clear_layer', {})).toThrow()
  for (const options of [{id: ' '}, {lineWidth: 0}, {lineStyle: 'wide'}, {priority: Infinity}, {color: 'oops'}, {color: 0}, {fade: {start: 100}}, {fade: {power: 0}}, {fade: {near: 1}}]) {
    expect(() => run('add_layer', {
      id: 'notes',
      ...options,
    })).toThrow()
  }
  controller.abort()
  for (const name of ['clear_drawings', 'clear_layer', 'add_layer']) {
    expect(() => run(name, name === 'clear_drawings' ? {} : {id: 'notes'})).toThrow()
  }
})
test('text overlay calls reject ambiguous positions and invalid clears', () => {
  const controller = new AbortController
  const run = (name: string, input: Record<string, unknown>) => toolNamed(name).execute(input, {signal: controller.signal})
  for (const position of [null, {x: 1}, {
    x: 1,
    y: Infinity,
  }, {
    x: 1,
    y: 0,
    z: null,
  }, {
    x: 0,
    y: 0,
    unit: 'm',
  }]) {
    expect(() => run('add_text_overlay', {
      text: 'test',
      position,
    })).toThrow(TypeError)
  }
  expect(() => run('add_text_overlay', {text: ' '})).toThrow(TypeError)
  for (const anchor of [0, 10, 4.5, '7', null]) {
    expect(() => run('add_text_overlay', {
      text: 'test',
      anchor,
    })).toThrow(TypeError)
  }
  expect(() => run('clear_text_overlay', {id: 'some-drawing'})).toThrow(TypeError)
  controller.abort()
  expect(() => run('clear_text_overlay', {})).toThrow()
})
test('show_fence selects all, one or no fences and preserves the selection on errors', () => {
  const tool = toolNamed('show_fence')
  const controller = new AbortController
  const execute = (input: Record<string, unknown>) => tool.execute(input, {signal: controller.signal})
  const original = useFenceDisplay.getState()
  try {
    expect(tool.annotations?.readOnlyHint).toBe(false)
    expect(execute({})).toEqual({fence: true})
    expect(useFenceDisplay.getState().fence).toBe(true)
    expect(execute({fence: 'lobby-north'})).toEqual({fence: 'lobby-north'})
    expect(execute({fence: '{lobby,lodge*}'})).toEqual({fence: '{lobby,lodge*}'})
    for (const input of [{fence: 'unknown*'}, {fence: ''}, {fence: 7}, {unknown: true}]) {
      expect(() => execute(input)).toThrow()
    }
    expect(useFenceDisplay.getState().fence).toBe('{lobby,lodge*}')
    expect(execute({fence: false})).toEqual({fence: false})
    controller.abort()
    expect(() => execute({})).toThrow()
    expect(useFenceDisplay.getState().fence).toBe(false)
  } finally {
    useFenceDisplay.setState(original)
  }
})
test('show_colliders can select future objects, show all or hide them without changing the selection on invalid or aborted calls', () => {
  const tool = toolNamed('show_colliders')
  const controller = new AbortController
  const execute = (input: unknown) => tool.execute(input as Record<string, unknown>, {signal: controller.signal})
  const original = useColliderDisplay.getState()
  try {
    expect(tool.annotations?.readOnlyHint).toBe(false)
    expect(execute({})).toEqual({object: true})
    expect(execute({object: false})).toEqual({object: false})
    expect(execute({object: ' /props/ prop-orb-* / '})).toEqual({object: 'props/prop-orb-*'})
    for (const invalid of [null, [], {object: ''}, {object: '/'}, {object: null}, {object: 1}, {unknown: true}]) {
      expect(() => execute(invalid)).toThrow(TypeError)
    }
    controller.abort()
    expect(() => execute({})).toThrow()
    expect(useColliderDisplay.getState()).toEqual({object: 'props/prop-orb-*'})
  } finally {
    useColliderDisplay.setState(original)
  }
})
test('download_frame validates its optional name and downloads through the bridge', async () => {
  const tool = toolNamed('download_frame')
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
  const tool = toolNamed('end_warmup')
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
  const tool = toolNamed('set_wireframe')
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
    background: '#123',
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
    highlight: 'lobby-fountain/fountain-falling-water',
    color: '#f00',
    highlight_color: '#2F7BFF',
    background: '#123',
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
  expect(execute({highlight: 'alchemy-machine/{alchemy-machine,alchemy-cannon}'})).toHaveProperty('highlight', 'alchemy-machine/{alchemy-machine,alchemy-cannon}')
  expect(execute({highlight: null})).toHaveProperty('highlight', null)
  expect(execute({mode: 'combined'})).toHaveProperty('mode', 'combined')
  expect(execute({})).toEqual({
    enabled: false,
    direction: 'in',
    mode: 'triangle',
    anchor: 'nearest',
    shape: 'sphere',
    position: [0, 0, 0],
    radius: 0,
    highlight: null,
    color: null,
    highlight_color: null,
    background: null,
    seam_width: null,
    glow_duration: 1,
    seam_color: null,
    seam_intensity: 0.9,
    angle_indicator_strength: 0,
    speed: null,
    burst: 1,
    burst_duration: 0.5,
    antialiasing: false,
    line_style: 'barycentric',
    line_width: 0.5,
  })
  for (const input of [null, [], {unexpected: true}, {enabled: 1}, {position: [1, 2]}, {position: [1, 2, Number.NaN]}, {position: '0,0,0'}, {radius: -1}, {radius: '2'}, {radius: Number.POSITIVE_INFINITY}, {highlight: ''}, {highlight: ' / '}, {highlight: ['a']}, {highlight: 5}, {color: 'red'}, {color: '#12345'}, {highlight_color: 3}, {background: 'black'}, {background: '#12345'}, {mode: 'edge'}, {anchor: 'middle'}, {shape: 'cube'}, {seam_width: 0}, {seam_width: '1'}, {seam_color: 'blue'}, {seam_intensity: -1}, {glow_duration: -0.1}, {glow_duration: Number.NaN}, {seam_intensity: null}, {angle_indicator_strength: 101}, {angle_indicator_strength: -1}, {angle_indicator_strength: '10'}, {speed: -1}, {speed: '8'}, {burst: -0.5}, {burst: null}, {burst_duration: 0}, {antialiasing: 1}, {line_style: 'dashed'}, {line_width: 0}, {direction: 'up'}, {direction: true}]) {
    expect(() => execute(input)).toThrow(TypeError)
  }
  controller.abort()
  expect(() => execute({})).toThrow()
})
test('throw_prop takes a prop and exactly one of a portrait, a target or a velocity, and throws through the bridge', () => {
  const tool = toolNamed('throw_prop')
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
  const tool = toolNamed('spawn_orb')
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
test('spawn_sloperator takes an optional sight and brings him there through the bridge, and trigger_sloperator_sighting takes an optional sight and an optional instant', async () => {
  const calls: Array<unknown> = []
  const tools = createWebmcpTools({
    ...bridge,
    spawnSloperator(input) {
      calls.push(input)
      return bridge.spawnSloperator(input)
    },
    triggerSloperatorSighting(input) {
      calls.push(input)
      return bridge.triggerSloperatorSighting(input)
    },
  })
  const controller = new AbortController
  const run = (name: string, input: unknown) => tools.find(tool => tool.name === name)!.execute(input as Record<string, unknown>, {signal: controller.signal})
  for (const name of ['spawn_sloperator', 'trigger_sloperator_sighting']) {
    expect(tools.find(tool => tool.name === name)!.annotations?.readOnlyHint).toBe(false)
  }
  expect(await run('spawn_sloperator', {sight: 'salon_ottoman'})).toEqual(await bridge.spawnSloperator({sight: 'salon_ottoman'}))
  expect(await run('spawn_sloperator', {})).toEqual(await bridge.spawnSloperator({}))
  expect(run('trigger_sloperator_sighting', {sight: 'salon_ottoman'})).toEqual(bridge.triggerSloperatorSighting({sight: 'salon_ottoman'}))
  expect(run('trigger_sloperator_sighting', {instant: true})).toEqual(bridge.triggerSloperatorSighting({}))
  expect(calls).toEqual([{sight: 'salon_ottoman'}, {sight: undefined}, {
    instant: undefined,
    sight: 'salon_ottoman',
  }, {
    instant: true,
    sight: undefined,
  }])
  for (const input of [null, [], {sight: ''}, {sight: 3}, {
    sight: 'lobby_east_bench',
    instant: true,
  }]) {
    expect(() => run('spawn_sloperator', input)).toThrow(TypeError)
  }
  for (const input of [null, [], {sight: ''}, {sight: 3}, {
    sight: 'lobby_east_bench',
    instant: 'yes',
  }, {
    sight: 'lobby_east_bench',
    pose: 'sit',
  }]) {
    expect(() => run('trigger_sloperator_sighting', input)).toThrow(TypeError)
  }
  controller.abort()
  expect(() => run('spawn_sloperator', {sight: 'lobby_east_bench'})).toThrow()
})
test('in a world without the Sloperator, his tools do nothing without a sight and fail for one', async () => {
  const withdraw = provideSloperator({
    dump: () => [],
    sight: () => [],
    spawn: () => Promise.resolve([]),
  })
  withdraw()
  expect(dumpSloperator()).toEqual([])
  expect(await spawnSloperator({})).toEqual([])
  expect(triggerSloperatorSighting({instant: true})).toEqual([])
  await expect(spawnSloperator({sight: 'salon_ottoman'})).rejects.toThrow('This world has no Sloperator.')
  expect(() => triggerSloperatorSighting({sight: 'salon_ottoman'})).toThrow('This world has no Sloperator.')
})
test('spawn_party_effect takes an effect, a point and an optional rotation, floor and delay, and spawns through the bridge', async () => {
  const tool = toolNamed('spawn_party_effect')
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
  const tool = toolNamed('cast_mood')
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
test('reroll_seed takes an empty input object and rerolls through the bridge', async () => {
  const tool = toolNamed('reroll_seed')
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
test('set_seed accepts the default or a canonical rolled seed and sets it through the bridge', async () => {
  const tool = toolNamed('set_seed')
  const controller = new AbortController
  const execute = (input: unknown) => Promise.try(() => tool.execute(input as Record<string, unknown>, {signal: controller.signal}))
  expect(tool.annotations?.readOnlyHint).toBe(false)
  for (const seed of [0, 42, 65_536]) {
    expect(await execute({seed})).toEqual(bridge.setSeed({seed}))
  }
  for (const input of [null, [], {}, {seed: -1}, {seed: 1.5}, {seed: 65_537}, {seed: '42'}, {seed: Number.NaN}, {seed: undefined}, {
    seed: 1,
    reload: true,
  }]) {
    await expect(execute(input)).rejects.toThrow(TypeError)
  }
  controller.abort()
  await expect(execute({seed: 1})).rejects.toThrow()
})
test('add_portrait takes an image URL, exactly one kind of target and an optional title, id, frame, canvas material and size, and adds through the bridge', async () => {
  const tool = toolNamed('add_portrait')
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
    canvas_material: 'linen',
    size: 7500,
  })).toMatchObject({
    title: 'Invader',
    id: 'film-invader',
    frame: 'louis',
    canvasMaterial: 'linen',
    size: 7500,
  })
  expect(await execute({
    image,
    target: slot,
    hanging_animation: true,
  })).toHaveProperty('hangingAnimation', true)
  // Its schema offers every canvas material there is.
  expect(tool.inputSchema).toHaveProperty(['properties', 'canvas_material', 'enum'], [...canvasMaterialIds])
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
  }, ...['', 'velvet', 'Linen', 3, null].map(canvasMaterial => ({
    image,
    target: slot,
    canvas_material: canvasMaterial,
  })), ...[0, -7500, Infinity, '7500'].map(size => ({
    image,
    target: slot,
    size,
  })), ...['true', 1, null].map(hangingAnimation => ({
    image,
    target: slot,
    hanging_animation: hangingAnimation,
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
test('unmounting revokes every registered tool', async () => {
  const controller = new AbortController
  const registrations = new Map<string, AbortSignal>
  await registerWebmcp(bridge, controller, {async registerTool(tool, options) {
    registrations.set(tool.name, options!.signal!)
  }})
  expect(registrations.keys().toArray().toSorted()).toEqual(galleryTools.map(tool => tool.name).toSorted())
  expect(registrations.values().some(signal => signal.aborted)).toBe(false)
  controller.abort()
  expect(registrations.values().every(signal => signal.aborted)).toBe(true)
})
test.each(['failure', 'unmount', 'already unmounted'])('registration stops on %s and leaves no tools behind', async mode => {
  const controller = new AbortController
  if (mode === 'already unmounted') {
    controller.abort()
  }
  const signals: Array<AbortSignal> = []
  const registering = registerWebmcp(bridge, controller, {async registerTool(_tool, options) {
    signals.push(options!.signal!)
    if (mode === 'failure' && signals.length === 2) {
      throw new Error('Registration failed')
    }
    if (mode === 'unmount') {
      controller.abort()
    }
  }})
  if (mode === 'failure') {
    await expect(registering).rejects.toThrow('Registration failed')
    expect(signals).toHaveLength(2)
  } else {
    await registering
    expect(signals).toHaveLength(mode === 'unmount' ? 1 : 0)
  }
  expect(signals.every(signal => signal.aborted)).toBe(true)
})
