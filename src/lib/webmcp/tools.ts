import type {FrameDownload, FrameFormat} from '#src/lib/downloadFrame.ts'
import type {PortraitSlot} from '#src/lib/gallery/types.ts'
import type {PlayerDumpSnapshot} from '#src/lib/telemetry/recordPlayerDump.ts'
import type {WorldAnalysis} from './analyzeWorld.ts'
import type {PortraitDump} from './dumpPortraits.ts'
import type {WorkHanging, WorkHangingInput} from './hangWork.ts'
import type {OrbSpawn, OrbSpawnInput} from './spawnOrb.ts'
import type {PropThrow, PropThrowInput} from './throwProp.ts'
import type {WireframeFlood} from 'capture-session'
import type {WarmupEnd} from 'capture-session/script'
import type {AimSnapshot} from 'ego-player'
import type {Rarity} from 'knot-materials/rarities.ts'
import type VictoriaClient from 'victoria-browser-client'

import {normalizeMeshPath, wireframeFloodAnchors, wireframeFloodDirections, wireframeFloodModes, wireframeFloodShapes, wireframeLineStyles} from 'capture-session'

export type KnotDump = {
  id: string
  name: string
  position: [number, number, number]
  rarity: Rarity
}

export type WebmcpBridge = {
  analyzeWorld: () => WorldAnalysis
  downloadFrame: (options: {
    format?: FrameFormat
    name?: string
  }) => Promise<FrameDownload & {dump: PlayerDumpSnapshot | null}>
  endWarmup: () => Promise<WarmupEnd>
  getAim: () => AimSnapshot
  getKnots: () => ReadonlyArray<KnotDump>
  getLoadingItems: () => ReadonlyArray<string>
  getPortraits: () => ReadonlyArray<PortraitDump>
  getPortraitSlots: () => ReadonlyArray<PortraitSlot>
  getTelemetry: () => {
    collection: ReturnType<VictoriaClient['collectionStatus']>
    delivery: ReturnType<VictoriaClient['status']>
    sessionId: string
  } | null
  hangWork: (input: WorkHangingInput) => Promise<WorkHanging>
  setWireframe: (flood: Partial<WireframeFlood>) => WireframeFlood
  spawnOrb: (input: OrbSpawnInput) => Promise<OrbSpawn>
  throwProp: (input: PropThrowInput) => PropThrow
}

const frameFormats: Array<FrameFormat> = ['webp', 'png']
const fileNamePattern = /^[\w\-.]{1,100}$/u
const colorPattern = /^#(?:[\da-f]{3}){1,2}$/iu
const throwKeys = ['prop', 'portrait', 'target', 'velocity', 'from', 'speed']
const spawnKeys = new Set(['orb', 'position', 'id'])
const hangKeys = new Set(['image', 'slot', 'title', 'id'])
const workIdPattern = /^[\w-]{1,100}$/u
const propIdPattern = /^prop-[\w-]{1,100}$/u
const isPoint = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every(number => typeof number === 'number' && Number.isFinite(number))
const point = (description: string) => ({
  type: 'array',
  description,
  items: {type: 'number'},
  minItems: 3,
  maxItems: 3,
})
const wireframeKeys = ['enabled', 'direction', 'mode', 'anchor', 'shape', 'position', 'radius', 'highlight', 'color', 'highlight_color', 'seam_width', 'glow_duration', 'seam_color', 'seam_intensity', 'angle_indicator_strength', 'speed', 'burst', 'burst_duration', 'antialiasing', 'line_style', 'line_width']

export default function createWebmcpTools(getBridge: () => WebmcpBridge): Array<WebMCP.ModelContextTool> {
  const readTools: Array<WebMCP.ModelContextTool> = [
    {
      name: 'get_aim',
      title: 'Inspect player aim',
      description: 'Read the current camera ray and visible mesh hits ordered by distance. Includes full-precision world and local positions, surface normals, instance IDs, UVs, materials and ancestor metadata. Read-only: does not move the player, change focus or simulate input. Use world-space hit points and normals for scene placement.',
      read: () => getBridge().getAim(),
    },
    {
      name: 'get_telemetry',
      title: 'Inspect telemetry delivery',
      description: 'Read the current session ID, collection limits and Victoria delivery status, or null when telemetry is disabled. Use the session ID to correlate VictoriaLogs, VictoriaMetrics, VictoriaTraces and X-key ego.dump records (X dumps only with ?development). Does not enable telemetry or send data.',
      read: () => getBridge().getTelemetry(),
    },
    {
      name: 'dump_knots',
      title: 'Dump current Knots',
      description: 'Return every Knot currently present in the world with its canonical ID, display name, world position and current session rarity: Knottingham’s exhibition, including unsaved sign edits in its rarity edit mode, or the Knots the gallery showcases, like the one on the Salon’s pedestal, once their rooms have loaded.',
      read: () => getBridge().getKnots(),
    },
    {
      name: 'dump_portrait_slots',
      title: 'Dump portrait slots',
      description: 'Return every portrait slot of the world with its ID, wall ID, ratio, priority for default works, frame width and height in meters, world-space frame center, rotation, whether its placard hangs above the frame and the frame of its room, which its default work wears (left out for the default frame). With ?edit_portrait_slots, this includes the edits made on this page. Worlds without slots return an empty array.',
      read: () => getBridge().getPortraitSlots(),
    },
    {
      name: 'dump_portraits',
      title: 'Dump portraits',
      description: 'Return every work of the collection where it is now, hung, lying, flying or held by a fusion: its ID, title, whether it hangs and on which wall, its frame width and height in meters, the frame it wears unless the default one, whether a fusion holds it (fusing) or waits for one (pending), the world-space middle of its frame and its rotation as a quaternion [x, y, z, w], before which its front faces +z and its top +y. Poll it to follow a work through the air, like the result a fusion flips out of its portal, which joins the collection as it does.',
      read: () => getBridge().getPortraits(),
    },
    {
      name: 'analyze_world',
      title: 'Analyze world per room',
      description: 'Sort every visible mesh of the scene into the room holding most of its world bounding box (summed over instances) and every light into the room whose fence holds it, and report rooms keyed by id, each with its title, its fence (one axis-aligned box of min/max corners in world meters from floor to clear height, or a list of them: the Corridor’s strips round the Lodge’s bay, its hall and its stair to the Sienna, the Lodge with its threshold and the box around its bay), its static meshes (scene path of named ancestors, instances unless just 1, material name or type, a list for several and left out for a plain MeshStandardNodeMaterial, spill: the other rooms holding at least 1% of its bounding volume, and triangles, most triangles first), its items (what can be picked up and carried into another room, like props and portraits, in the room holding their origin now: prop or portrait id, meshes and triangles, most triangles first) and its lights (type, world position, color, intensity, range, decay, spot cone and shadow: own for a shadow map of its own, pooled for one borrowed from the shadow pool while in view, left out without one; the pool’s own slots are not listed). A mesh meeting no fence, like a crater floor, goes to the room above or below it. Meshes mostly outside every room, such as in passages and stairways, and lights outside every fence seen from above are listed under elsewhere; ambient, hemisphere and directional lights under globalLights. Triangle counts follow draw ranges and instance counts, not per-frame culling. Worlds without rooms list everything under elsewhere.',
      read: () => getBridge().analyzeWorld(),
    },
    {
      name: 'get_loading_items',
      title: 'List loading items',
      description: 'List the IDs of everything still loading that would leave something out of the next frame, one per line, or an empty string once nothing is left. IDs start with their kind: artwork: (decoding), pipeline: (compiling in the background), warmup (the loading screen’s pipeline warmup), stream: (objects waiting to stream in), shadow-map: (shadow maps missing streamed objects), room: (gallery rooms downloading or waiting to mount), knot-material:, billboard-texture:, model-sign-texture:, knot-sign-texture (the Knots’ nameplates) and canvas-text: (lines of text drawn on canvases, like the portraits’ placards). Captures poll this until it is empty before rendering a frame. A new pose can bring new items. Read-only.',
      read: () => getBridge().getLoadingItems().join('\n'),
    },
  ].map(({read, ...tool}) => ({
    ...tool,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: true,
    },
    execute: (input: unknown, {signal}) => {
      signal.throwIfAborted()
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) {
        throw new TypeError('This tool takes an empty input object.')
      }
      return read()
    },
  }))
  return [
    ...readTools,
    {
      name: 'download_frame',
      title: 'Download current frame',
      description: 'Render the current camera view once more through the WebGPU capture bridge and save it as a lossless WebP or PNG browser download. DOM overlays such as menus are not in it. Returns the file name, format, width, height and encoded byte size (PNG also reports the nonblack pixel fraction), plus `dump`: the same player snapshot the X key prints (player and input state, camera pose, rounded aim hits, gallery context and query overrides), taken right before the frame, or null without a player. Unlike X, it is not logged, copied or confirmed with a sound. Does not move the player, change focus or simulate input.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'file name without extension, made of letters, digits, “_”, “.” and “-”. Default: <world>-<dump id>, like X dump screenshots, or <world>-<timestamp> without a player',
            pattern: fileNamePattern.source,
          },
          format: {
            type: 'string',
            description: 'image format. PNG is what the capture bridge encodes anyway; WebP is smaller. Default: webp',
            enum: frameFormats,
          },
        },
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: async (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'name' && key !== 'format')) {
          throw new TypeError('This tool takes an object with an optional name and format.')
        }
        const {name, format} = input as {
          format?: unknown
          name?: unknown
        }
        if (name !== undefined && (typeof name !== 'string' || !fileNamePattern.test(name))) {
          throw new TypeError(`name must match ${fileNamePattern}.`)
        }
        if (format !== undefined && !frameFormats.includes(format as FrameFormat)) {
          throw new TypeError(`format must be one of ${frameFormats.join(', ')}.`)
        }
        return getBridge().downloadFrame({
          name,
          format: format as FrameFormat | undefined,
        })
      },
    },
    {
      name: 'end_warmup',
      title: 'End capture warmup',
      description: 'End the capture warmup of a page opened with ?warmup_scale, which renders at that reduced scale until now so everything loads while frames are cheap, and resolve once the canvas has its regular size. Returns whether the page was still warming up and the width and height of the drawing buffer it renders at from now on. Frames captured during the warmup fail. Render a few frames before capturing, so temporal antialiasing builds its history at the new size. Pages without a warmup report warmed: false.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) {
          throw new TypeError('This tool takes an empty input object.')
        }
        return getBridge().endWarmup()
      },
    },
    {
      name: 'throw_prop',
      title: 'Throw prop',
      description: 'Throw a prop, like an orb, the way the player throws one: loose and tumbling, from where a carried orb floats in front of the camera unless from says otherwise, so a hung portrait it strikes opens a fusion like a player’s throw does. Give exactly one of portrait (it flies at the portrait’s middle), target (it flies through the point) or velocity; with a portrait or a target it leaves at speed on the flatter of the two arcs that reach it. Fails for an unknown prop, one that is carried or held by a fusion and a target out of reach at that speed. Returns where it left from, its velocity in m/s and, with a portrait or a target, the seconds until it gets there. Prop ids are the items analyze_world lists, like prop-orb-spook. Does not move the player, change focus or simulate input.',
      inputSchema: {
        type: 'object',
        properties: {
          prop: {
            type: 'string',
            description: 'id of the prop to throw',
          },
          portrait: {
            type: 'string',
            description: 'id of the portrait to throw it at',
          },
          target: point('world-space point in meters it flies through, [x, y, z]'),
          velocity: point('world-space velocity in m/s it leaves with, [x, y, z], instead of flying at a portrait or a target'),
          from: point('world-space point in meters it leaves from, [x, y, z]. Default: where a carried orb floats, 0.55 m from the camera, 15° below the middle of the view'),
          speed: {
            type: 'number',
            description: 'm/s it leaves with toward a portrait or a target. Default: 10, the player’s throw',
            exclusiveMinimum: 0,
          },
        },
        required: ['prop'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !throwKeys.includes(key))) {
          throw new TypeError(`This tool takes an object with prop and optional ${throwKeys.slice(1).join(', ')}.`)
        }
        const {prop, portrait, target, velocity, from, speed} = input as Record<string, unknown>
        if (typeof prop !== 'string' || !prop) {
          throw new TypeError('prop must be the id of a prop.')
        }
        if (portrait !== undefined && (typeof portrait !== 'string' || !portrait)) {
          throw new TypeError('portrait must be the id of a portrait.')
        }
        for (const [key, value] of [['target', target], ['velocity', velocity], ['from', from]] as const) {
          if (value !== undefined && !isPoint(value)) {
            throw new TypeError(`${key} must be three finite numbers.`)
          }
        }
        if ([portrait, target, velocity].filter(value => value !== undefined).length !== 1) {
          throw new TypeError('Give exactly one of portrait, target or velocity.')
        }
        if (speed !== undefined && !(typeof speed === 'number' && Number.isFinite(speed) && speed > 0)) {
          throw new TypeError('speed must be a finite number above 0.')
        }
        return getBridge().throwProp({
          prop,
          portrait,
          target: target as [number, number, number] | undefined,
          velocity: velocity as [number, number, number] | undefined,
          from: from as [number, number, number] | undefined,
          speed,
        })
      },
    },
    {
      name: 'spawn_orb',
      title: 'Spawn orb',
      description: 'Bring an orb of any kind into the world at a point, where it lies, rolls and falls like any other, so throw_prop can throw it even where the game has none of its kind yet, like the Horror Orb that only the Forge’s alchemy machine makes. Resolves once its prop is in the world, which renders it from the next frame on. Fails for an unknown kind, whose error lists the kinds, and for an id a prop already has. Returns its prop id, its kind and where it entered. Does not move the player, change focus or simulate input.',
      inputSchema: {
        type: 'object',
        properties: {
          orb: {
            type: 'string',
            description: 'the kind of orb, like horror, spook, halloween, paint or transparent',
          },
          position: point('world-space point in meters where its middle enters the world, [x, y, z]'),
          id: {
            type: 'string',
            description: 'its prop id, unique in the world. Default: the kind’s prop id, numbered like prop-orb-horror-spawned-1',
            pattern: propIdPattern.source,
          },
        },
        required: ['orb', 'position'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !spawnKeys.has(key))) {
          throw new TypeError('This tool takes an object with orb, position and an optional id.')
        }
        const {orb, position, id} = input as Record<string, unknown>
        if (typeof orb !== 'string' || !orb) {
          throw new TypeError('orb must be the id of a kind of orb.')
        }
        if (!isPoint(position)) {
          throw new TypeError('position must be three finite numbers.')
        }
        if (id !== undefined && (typeof id !== 'string' || !propIdPattern.test(id))) {
          throw new TypeError(`id must match ${propIdPattern}.`)
        }
        return getBridge().spawnOrb({
          orb,
          position,
          id,
        })
      },
    },
    {
      name: 'hang_work',
      title: 'Hang work',
      description: 'Hang an image in a portrait slot as an imported work, in place of the work hanging there, if any: cropped to its middle if wider than 2:1 or taller than 1:2, in its own aspect at the slot’s frame area, wearing the roll of its id of the slot’s frames or of its room’s, right away without the hanging animation or the sound of an arrival. Resolves once it hangs, while its image may still decode. Fails for an unknown slot, an id a work already has, an image that does not load or is no PNG, JPEG, WebP, AVIF or GIF up to 25 mb, and a full collection. Returns its new id, its title, the slot, the id of the work it replaced, where its frame’s middle is, its rotation and its frame width and height in meters. Slot ids are what dump_portrait_slots lists. Does not move the player, change focus or simulate input.',
      inputSchema: {
        type: 'object',
        properties: {
          image: {
            type: 'string',
            description: 'URL of the image, which the page fetches',
          },
          slot: {
            type: 'string',
            description: 'id of the portrait slot it hangs in',
          },
          title: {
            type: 'string',
            description: 'its title. Default: the image’s file name without its extension, dashes and underscores as spaces, as an import names it',
            minLength: 1,
            maxLength: 150,
          },
          id: {
            type: 'string',
            description: 'its id, unique in the collection, which tells the same roll of frames every time, for it and for the result of a fusion that takes it. Default: a new one',
            pattern: workIdPattern.source,
          },
        },
        required: ['image', 'slot'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !hangKeys.has(key))) {
          throw new TypeError('This tool takes an object with image, slot and an optional title and id.')
        }
        const {image, slot, title, id} = input as Record<string, unknown>
        if (typeof image !== 'string' || !URL.canParse(image, typeof location === 'undefined' ? undefined : location.href)) {
          throw new TypeError('image must be the URL of an image.')
        }
        if (typeof slot !== 'string' || !slot) {
          throw new TypeError('slot must be the id of a portrait slot.')
        }
        if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.length > 150)) {
          throw new TypeError('title must be a text of 1 to 150 characters.')
        }
        if (id !== undefined && (typeof id !== 'string' || !workIdPattern.test(id))) {
          throw new TypeError(`id must match ${workIdPattern}.`)
        }
        return getBridge().hangWork({
          image,
          slot,
          title,
          id,
        })
      },
    },
    {
      name: 'set_wireframe',
      title: 'Set wireframe flood',
      description: 'Show every visible surface within a sphere as wireframe, with a glowing seam along its front, while the rest of the frame renders as usual, or the other way around. Surfaces flip by the distance of their triangles or of each pixel, both measured on the wireframe’s solid surfaces, so transparent ones like water flip too. Meant for headless rendering, as it draws the scene up to three extra times per frame. Highlighted objects draw in their own color, everything else in the regular one. Takes effect from the next frame and stays until changed; omitted fields keep their current value, and a null color returns to its fallback. Starts disabled. Needs the regular render pipeline, so ?show_wireframe replaces it. Returns the whole flood now in effect.',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'whether the flood renders at all',
          },
          direction: {
            type: 'string',
            enum: [...wireframeFloodDirections],
            description: 'in (at first) turns everything the sphere reaches into wireframe; out starts from a frame that is all wireframe and turns everything the sphere reaches back into the scene. A new direction, or the first one sent, turns the flood on unless enabled says otherwise and starts it over from the radius sent along, or from 0',
          },
          mode: {
            type: 'string',
            enum: [...wireframeFloodModes],
            description: 'triangle (default) flips each triangle whole once the sphere reaches its anchor, with the seam glowing on whole triangles for a while after they flip; pixel flips every pixel by its own distance, with a soft edge and the seam along the sphere’s border; combined flips like triangle but glows both ways',
          },
          anchor: {
            type: 'string',
            enum: [...wireframeFloodAnchors],
            description: 'what point of a triangle decides when it flips, in triangle and combined mode: nearest (default) flips it as soon as the sphere touches it, centroid once the sphere reaches its middle, farthest once the sphere encloses it',
          },
          shape: {
            type: 'string',
            enum: [...wireframeFloodShapes],
            description: 'sphere (default) floods in 3D; circle measures only horizontally, flooding as a vertical cylinder around the position',
          },
          position: {
            type: 'array',
            description: 'world-space center of the sphere in meters, [x, y, z]',
            items: {type: 'number'},
            minItems: 3,
            maxItems: 3,
          },
          radius: {
            type: 'number',
            description: 'sphere radius in meters',
            minimum: 0,
          },
          highlight: {
            description: 'one mesh path or several, like “lobby-fountain” or “lobby-fountain/fountain-falling-water”; their objects and everything below them draw in the highlight color. An empty array highlights nothing',
            anyOf: [
              {type: 'string'},
              {
                type: 'array',
                items: {type: 'string'},
              },
            ],
          },
          color: {
            description: 'line color of everything not highlighted, as #rgb or #rrggbb. Fallback: #ff1515 beside highlights, #40ff40 otherwise',
            anyOf: [
              {
                type: 'string',
                pattern: colorPattern.source,
              },
              {type: 'null'},
            ],
          },
          highlight_color: {
            description: 'line color of the highlighted objects, as #rgb or #rrggbb. Fallback: #2f7bff',
            anyOf: [
              {
                type: 'string',
                pattern: colorPattern.source,
              },
              {type: 'null'},
            ],
          },
          seam_width: {
            description: 'meters from the sphere’s border at which its seam glow falls to 1/e, in pixel and combined mode. Fallback: grows with the radius, 0.06 + 0.12 per meter',
            anyOf: [
              {
                type: 'number',
                exclusiveMinimum: 0,
              },
              {type: 'null'},
            ],
          },
          glow_duration: {
            type: 'number',
            description: 'seconds a flipped triangle glows, starting in its full line color the moment it flips and fading into what it flipped to with a steep exponential ease-out, in triangle and combined mode, 1 at first; 0 turns the triangle glow off',
            minimum: 0,
          },
          seam_color: {
            description: 'glow color of the seam along the sphere’s border, as #rgb or #rrggbb; flipped triangles glow in their own line color. Fallback: #a8d4ff',
            anyOf: [
              {
                type: 'string',
                pattern: colorPattern.source,
              },
              {type: 'null'},
            ],
          },
          seam_intensity: {
            type: 'number',
            description: 'peak brightness the seam along the sphere’s border adds, 0.9 at first; 0 turns it off',
            minimum: 0,
          },
          speed: {
            description: 'meters per second the radius keeps growing by, without an end, starting from the radius it has when direction, speed, burst, burst_duration or radius last changed; null leaves the radius as set. Sending the same values again keeps the flood going',
            anyOf: [
              {
                type: 'number',
                minimum: 0,
              },
              {type: 'null'},
            ],
          },
          burst: {
            type: 'number',
            description: 'how the speed starts out, as a multiple of it, 1 at first: above 1 the flood shoots out like a cannon and slows down to its speed, below 1 it builds up to it, 0 starting at rest',
            minimum: 0,
          },
          burst_duration: {
            type: 'number',
            description: 'seconds over which the burst eases into the regular speed, as the time constant of an exponential, 0.5 at first',
            exclusiveMinimum: 0,
          },
          line_style: {
            type: 'string',
            enum: [...wireframeLineStyles],
            description: 'barycentric (default) draws antialiased edges of line_width pixels as part of each face, exactly at its depth, so they never break up where surfaces nearly touch; lines draws 1 px hardware lines over the faces',
          },
          line_width: {
            type: 'number',
            description: 'pixels a barycentric edge is wide, 0.5 at first',
            exclusiveMinimum: 0,
          },
          antialiasing: {
            type: 'boolean',
            description: 'draws the wireframe with 4× MSAA for smooth lines, false at first',
          },
          angle_indicator_strength: {
            type: 'number',
            description: 'percent of its line color a wireframe face shows when facing the camera, 5 at first; edge-on faces are black',
            minimum: 0,
            maximum: 100,
          },
        },
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !wireframeKeys.includes(key))) {
          throw new TypeError(`This tool takes an object with optional ${wireframeKeys.join(', ')}.`)
        }
        const {enabled, direction, mode, anchor, shape, position, radius, highlight, color, highlight_color: highlightColor, seam_width: seamWidth, glow_duration: glowDuration, seam_color: seamColor, seam_intensity: seamIntensity, angle_indicator_strength: angleIndicatorStrength, speed, burst, burst_duration: burstDuration, antialiasing, line_style: lineStyle, line_width: lineWidth} = input as Record<string, unknown>
        if (enabled !== undefined && typeof enabled !== 'boolean') {
          throw new TypeError('enabled must be a boolean.')
        }
        if (direction !== undefined && !wireframeFloodDirections.includes(direction as typeof wireframeFloodDirections[number])) {
          throw new TypeError(`direction must be one of ${wireframeFloodDirections.join(', ')}.`)
        }
        if (mode !== undefined && !wireframeFloodModes.includes(mode as typeof wireframeFloodModes[number])) {
          throw new TypeError(`mode must be one of ${wireframeFloodModes.join(', ')}.`)
        }
        if (anchor !== undefined && !wireframeFloodAnchors.includes(anchor as typeof wireframeFloodAnchors[number])) {
          throw new TypeError(`anchor must be one of ${wireframeFloodAnchors.join(', ')}.`)
        }
        if (shape !== undefined && !wireframeFloodShapes.includes(shape as typeof wireframeFloodShapes[number])) {
          throw new TypeError(`shape must be one of ${wireframeFloodShapes.join(', ')}.`)
        }
        if (position !== undefined && !(Array.isArray(position) && position.length === 3 && position.every(value => typeof value === 'number' && Number.isFinite(value)))) {
          throw new TypeError('position must be three finite numbers.')
        }
        if (radius !== undefined && !(typeof radius === 'number' && Number.isFinite(radius) && radius >= 0)) {
          throw new TypeError('radius must be a finite number of at least 0.')
        }
        const paths = highlight === undefined ? undefined : [highlight].flat().map(path => normalizeMeshPath(path))
        if (paths?.includes(undefined)) {
          throw new TypeError('highlight must be a mesh path or an array of them.')
        }
        if (seamWidth !== undefined && seamWidth !== null && !(typeof seamWidth === 'number' && Number.isFinite(seamWidth) && seamWidth > 0)) {
          throw new TypeError('seam_width must be a finite number above 0 or null.')
        }
        for (const [key, value] of [['glow_duration', glowDuration], ['seam_intensity', seamIntensity]] as const) {
          if (value !== undefined && !(typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
            throw new TypeError(`${key} must be a finite number of at least 0.`)
          }
        }
        if (lineStyle !== undefined && !wireframeLineStyles.includes(lineStyle as typeof wireframeLineStyles[number])) {
          throw new TypeError(`line_style must be one of ${wireframeLineStyles.join(', ')}.`)
        }
        if (lineWidth !== undefined && !(typeof lineWidth === 'number' && Number.isFinite(lineWidth) && lineWidth > 0)) {
          throw new TypeError('line_width must be a finite number above 0.')
        }
        if (antialiasing !== undefined && typeof antialiasing !== 'boolean') {
          throw new TypeError('antialiasing must be a boolean.')
        }
        if (speed !== undefined && speed !== null && !(typeof speed === 'number' && Number.isFinite(speed) && speed >= 0)) {
          throw new TypeError('speed must be a finite number of at least 0 or null.')
        }
        if (burst !== undefined && !(typeof burst === 'number' && Number.isFinite(burst) && burst >= 0)) {
          throw new TypeError('burst must be a finite number of at least 0.')
        }
        if (burstDuration !== undefined && !(typeof burstDuration === 'number' && Number.isFinite(burstDuration) && burstDuration > 0)) {
          throw new TypeError('burst_duration must be a finite number above 0.')
        }
        if (angleIndicatorStrength !== undefined && !(typeof angleIndicatorStrength === 'number' && angleIndicatorStrength >= 0 && angleIndicatorStrength <= 100)) {
          throw new TypeError('angle_indicator_strength must be a percentage from 0 to 100.')
        }
        for (const [key, value] of [['color', color], ['highlight_color', highlightColor], ['seam_color', seamColor]] as const) {
          if (value !== undefined && value !== null && !(typeof value === 'string' && colorPattern.test(value))) {
            throw new TypeError(`${key} must be #rgb, #rrggbb or null.`)
          }
        }
        const flood = getBridge().setWireframe({
          enabled,
          direction: direction as WireframeFlood['direction'] | undefined,
          mode: mode as WireframeFlood['mode'] | undefined,
          anchor: anchor as WireframeFlood['anchor'] | undefined,
          shape: shape as WireframeFlood['shape'] | undefined,
          position: position as WireframeFlood['position'] | undefined,
          radius,
          highlight: paths as Array<string> | undefined,
          color: color as string | null | undefined,
          highlightColor: highlightColor as string | null | undefined,
          seamWidth,
          glowDuration: glowDuration as number | undefined,
          seamColor: seamColor as string | null | undefined,
          seamIntensity: seamIntensity as number | undefined,
          angleIndicatorStrength,
          speed,
          burst,
          burstDuration,
          antialiasing,
          lineStyle: lineStyle as WireframeFlood['lineStyle'] | undefined,
          lineWidth,
        })
        return {
          enabled: flood.enabled,
          direction: flood.direction,
          mode: flood.mode,
          anchor: flood.anchor,
          shape: flood.shape,
          position: flood.position,
          radius: flood.radius,
          highlight: flood.highlight,
          color: flood.color,
          highlight_color: flood.highlightColor,
          seam_width: flood.seamWidth,
          glow_duration: flood.glowDuration,
          seam_color: flood.seamColor,
          seam_intensity: flood.seamIntensity,
          angle_indicator_strength: flood.angleIndicatorStrength,
          speed: flood.speed,
          burst: flood.burst,
          burst_duration: flood.burstDuration,
          antialiasing: flood.antialiasing,
          line_style: flood.lineStyle,
          line_width: flood.lineWidth,
        }
      },
    },
  ]
}
