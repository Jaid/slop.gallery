import type {FrameDownload, FrameFormat} from '#src/lib/downloadFrame.ts'
import type {FenceDisplay} from '#src/lib/gallery/fenceDisplay.ts'
import type {PortraitSlot} from '#src/lib/gallery/types.ts'
import type {SeedChange} from '#src/lib/gameSeed.ts'
import type {Drawing} from '#src/lib/overlay/drawing.ts'
import type {LayerOptions} from '#src/lib/overlay/layer.ts'
import type {PlayerDumpSnapshot} from '#src/lib/telemetry/recordPlayerDump.ts'
import type {PortraitAddition, PortraitAdditionInput, PortraitTarget} from './addPortrait.ts'
import type {WorldAnalysis} from './analyzeWorld.ts'
import type {MoodCast, MoodCastInput} from './castMood.ts'
import type {SeedInput} from './changeSeed.ts'
import type {PortraitDump} from './dumpPortraits.ts'
import type {GeofenceQuery} from './getGeofences.ts'
import type {GraphicsQualityChange, GraphicsQualityInput} from './setGraphicsQuality.ts'
import type {SloperatorDump, SloperatorSightingDump, SloperatorSightingInput, SloperatorSpawnInput} from './sloperator.ts'
import type {OrbSpawn, OrbSpawnInput} from './spawnOrb.ts'
import type {PartyEffectSpawn, PartyEffectSpawnInput} from './spawnPartyEffect.ts'
import type {PropThrow, PropThrowInput} from './throwProp.ts'
import type {WireframeFlood} from 'capture-session'
import type {WarmupEnd} from 'capture-session/script'
import type {AimSnapshot} from 'ego-player'
import type {BoxInput} from 'geofency'
import type {Rarity} from 'knot-materials/rarities.ts'
import type VictoriaClient from 'victoria-browser-client'

import {normalizeMeshPath, wireframeFloodAnchors, wireframeFloodDirections, wireframeFloodModes, wireframeFloodShapes, wireframeLineStyles} from 'capture-session'

import {canvasMaterialIds, isCanvasMaterialId} from '#src/canvas_materials/lib/canvasMaterialIds.ts'
import {isSeed, maximumSeed} from '#src/lib/environmentSeed.ts'
import {drawingSchema, readDrawing} from '#src/lib/overlay/drawing.ts'
import {isLayerId, layerIdSchema, layerSchema, readLayer} from '#src/lib/overlay/layer.ts'

/** a fence of the world as the union of its boxes and the fences it takes in */
export type GeofenceDump = {
  /** its own boxes in world meters, each as the plain data geofency’s `createBox` builds it from: its footprint, and how far it reaches up and down; none for a fence made of other fences alone */
  boxes: Array<BoxInput>
  id: string
  /** the ids of the other fences of the world whose space it takes in, for a relational fence, like a room made of its parts */
  relations?: Array<string>
}

export type KnotDump = {
  id: string
  name: string
  position: [number, number, number]
  rarity: Rarity
}

export type TextOverlayInput = {
  anchor?: number
  position?: {
    x: number
    y: number
    z?: number
  }
  text: string
}

export type WebmcpBridge = {
  addDrawing: (drawing: Drawing) => {
    drawing: Drawing
    id: string
  }
  addLayer: (options: LayerOptions) => string
  addPortrait: (input: PortraitAdditionInput) => Promise<PortraitAddition>
  addTextOverlay: (input: TextOverlayInput) => {added: boolean}
  analyzeWorld: () => WorldAnalysis
  castMood: (input: MoodCastInput) => MoodCast
  clearDrawings: () => number
  clearLayer: (id: string) => number
  clearTextOverlay: () => number
  downloadFrame: (options: {
    format?: FrameFormat
    name?: string
  }) => Promise<FrameDownload & {dump: PlayerDumpSnapshot | null}>
  dumpGeofences: () => ReadonlyArray<GeofenceDump>
  dumpSloperator: () => ReadonlyArray<SloperatorDump>
  endWarmup: () => Promise<WarmupEnd>
  getAim: () => AimSnapshot
  getGeofences: (query: GeofenceQuery) => ReadonlyArray<string>
  getKnots: () => ReadonlyArray<KnotDump>
  getLoadingItems: () => ReadonlyArray<string>
  getPortraits: () => ReadonlyArray<PortraitDump>
  getPortraitSlots: () => ReadonlyArray<PortraitSlot>
  getTelemetry: () => {
    collection: ReturnType<VictoriaClient['collectionStatus']>
    delivery: ReturnType<VictoriaClient['status']>
    sessionId: string
  } | null
  rerollSeed: () => SeedChange
  setGraphicsQuality: (input: GraphicsQualityInput) => Promise<GraphicsQualityChange>
  setSeed: (input: SeedInput) => SeedChange
  setWireframe: (flood: Partial<WireframeFlood>) => WireframeFlood
  showFence: (input: FenceDisplay) => FenceDisplay
  spawnOrb: (input: OrbSpawnInput) => Promise<OrbSpawn>
  spawnPartyEffect: (input: PartyEffectSpawnInput) => PartyEffectSpawn
  spawnSloperator: (input: SloperatorSpawnInput) => Promise<Array<SloperatorDump>>
  throwProp: (input: PropThrowInput) => PropThrow
  triggerSloperatorSighting: (input: SloperatorSightingInput) => Array<SloperatorSightingDump>
}

const frameFormats: Array<FrameFormat> = ['webp', 'png']
const fileNamePattern = /^[\w\-.]{1,100}$/u
const colorPattern = /^#(?:[\da-f]{3}){1,2}$/iu
const throwKeys = ['prop', 'portrait', 'target', 'velocity', 'from', 'speed']
const spawnKeys = new Set(['orb', 'position', 'id'])
const partyKeys = new Set(['effect', 'position', 'rotation', 'floor', 'delay'])
const portraitKeys = new Set(['image', 'target', 'title', 'id', 'frame', 'canvas_material', 'size'])
const workIdPattern = /^[\w-]{1,100}$/u
const sightingKeys = new Set(['sight', 'instant'])
const propIdPattern = /^prop-[\w-]{1,100}$/u
const isPoint = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every(number => typeof number === 'number' && Number.isFinite(number))
const point = (description: string) => ({
  type: 'array',
  description,
  items: {type: 'number'},
  minItems: 3,
  maxItems: 3,
})
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
/** Whether the value is an object of exactly these keys, each a finite number. */
const isCoordinates = (value: unknown, keys: string) => isRecord(value) && Object.keys(value).toSorted().join(',') === keys && Object.values(value).every(number => typeof number === 'number' && Number.isFinite(number))
/** The target of add_portrait as its bridge takes it, or a TypeError for anything but exactly one of its three shapes. */
const readPortraitTarget = (target: unknown): PortraitTarget => {
  const shape = isRecord(target) ? Object.keys(target).toSorted().join(',') : ''
  const {slot, wall_id: wallId, position} = isRecord(target) ? target : {}
  if (shape === 'slot' && typeof slot === 'string' && slot) {
    return {slot}
  }
  if (shape === 'position,wall_id' && typeof wallId === 'string' && wallId && isCoordinates(position, 'x,y')) {
    return {
      wallId,
      position: position as {
        x: number
        y: number
      },
    }
  }
  if (shape === 'position' && isCoordinates(position, 'x,y,z')) {
    return {position: position as {
      x: number
      y: number
      z: number
    }}
  }
  throw new TypeError('target must be exactly one of {slot}, the id of a portrait slot, {wall_id, position}, the id of a wall with {x, y} on it in meters, or {position}, {x, y, z} in world meters.')
}
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
      description: 'Return every Knot currently present in the world with its canonical ID, display name, world position and current session rarity: Knottingham’s exhibition, including unsaved sign edits in its rarity edit mode, or the Knots the gallery showcases once their rooms have loaded.',
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
      description: 'Return every work of the collection where it is now, hung, lying, flying or held by a fusion: its ID, title, whether it hangs and on which wall, its frame width and height in meters, the frame it wears unless the default one, the canvas material its image is on (canvasMaterial) if any, whether a fusion holds it (fusing) or waits for one (pending), the world-space middle of its frame and its rotation as a quaternion [x, y, z, w], before which its front faces +z and its top +y. Poll it to follow a work through the air, like the result a fusion flips out of its portal, which joins the collection as it does.',
      read: () => getBridge().getPortraits(),
    },
    {
      name: 'dump_geofences',
      title: 'Dump geofences',
      description: 'Return every geofence of the world in the order the world checks them, each with its ID and all of its boxes in world meters, rounded to the tenth of a millimeter. A fence is the union of its boxes, and a relational fence, which lists relations, the IDs of other fences of the world, also takes in all of their space, through theirs, so it may have no boxes of its own: the gallery’s Lobby is its three parts. A box stands on the rectangle between the corners (x, z) and (x2, z2) on the ground and reaches from its floor up without end, from its ceiling down without end, from y up to y2, or, with none of them, up and down without end; its faces count as inside. The rooms’ fences come first, each under its room’s ID: where a visitor counts as being in the room, which overlaps its neighbors’ along shared walls and wherever one room lies over another. The first of them holding the player’s place is the room the player is in, which stays the last one while none holds it. After them come the rooms’ other fences, room by room, each under its room’s ID and its own joined by a hyphen, which mark places in the room where something happens, like its parts: in the gallery, the three parts of its Lobby from north to south, lobby-north with the glazed floor over the Oculus, lobby-middle around its fountain and lobby-south between the arches into the Vesper and the Banquet, moonfall-stairs, the stairway between the Antechamber and Moonfall, bastion-knight_alley, the Bastion’s blind branch beside the Lodge, where an empty suit of armor stands, bastion-cistern, the Bastion’s cistern behind the Forge’s vestibule, bastion-gate, the Bastion’s curve behind the gate in the Oculus’ apse, and corridor-window, the Corridor’s hall abreast of the Lodge’s west window. The game probes all of them for the player’s place once per frame, and the gallery.geofence.entered and gallery.geofence.left telemetry counts every fence on its own. Rooms this page’s ?world_reach leaves out are fenced too. get_geofences tells which fences hold a position.',
      read: () => getBridge().dumpGeofences(),
    },
    {
      name: 'dump_sloperator',
      title: 'Dump the Sloperator',
      description: 'Return every sight of the Sloperator, the bowler-hatted gentleman of the gallery’s icon, in rooms in this page’s ?world_reach, and what he is up to there, or an empty array in a world without him. A sight is a seat he turns up on, or a spot he stands on, while the player’s place is in its fence (id), seen from afar through a window or across a room: lodge_east_armchair from bastion-knight_alley, lodge_west_armchair from corridor-window, lobby_east_bench from salon, lobby_north_bench from oculus, salon_ottoman from forge, all seats, and exhibition_glass from bastion-gate, where he stands. Entering that fence makes the physics place him once, on its next step: on his seat where it stood when the game began, on it where it went if it was pushed or turned a little, or standing where it stood once it is gone, or on his spot; anything else in the box he takes up there from his neutral pose through his sight pose keeps him away until the player enters the fence anew. state is away while the player is out of the fence, waiting until the physics placed him, seated, standing, kept_away, or slopped once he left his Slop there after the player caught sight of him and left the fence, never to return; pinned whether spawn_sloperator keeps him there wherever the player goes. detection tells how the physics found his seat, like the gallery.sloperator_spawn log event: present, moved or missing where he turned up, none where he stands at a sight without a seat, moved (too little to be gone but too far to sit on) or blocked where he stays away. pose (sit, sit_armchair or stand), position (the point on the floor under him, in world meters) and yaw (his turn around y in radians) tell how and where he is or where he left his Slop; sighted whether the player caught sight of him there since entering the fence, by aiming at him zoomed in all the way or through trigger_sloperator_sighting, which makes him get up off his seat or bring his hands behind his back; seat, at a sight with one, how far his seat strayed from where it stood when the game began, as it stands now: moved, how far the spot he sits on moved along the floor in meters, turned and tilted, how far it turned around y and leans from upright in radians. He follows a seat that moved up to 0.3 m, turned up to 20° and leans up to 5°. Read-only.',
      read: () => getBridge().dumpSloperator(),
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
      description: 'List the IDs of everything still loading that would leave something out of the next frame, one per line, or an empty string once nothing is left. IDs start with their kind: artwork: (decoding), pipeline: (compiling in the background), warmup (the loading screen’s pipeline warmup), stream: (objects waiting to stream in), shadow-map: (shadow maps missing streamed objects), room: (gallery rooms downloading or waiting to mount), knot-material:, billboard-texture:, model-sign-texture:, knot-sign-texture (the Knots’ nameplates) and element-text: (lines of text laid out as HTML, like the portraits’ placards). Captures poll this until it is empty before rendering a frame. A new pose can bring new items. Read-only.',
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
      name: 'get_geofences',
      title: 'Find geofences at a position',
      description: 'Return the IDs of every geofence that holds a position, in the order the world checks them, or an empty array outside of every fence, like outside of the world. Without a position, it takes the player’s place, which the game follows through the fences itself: the middle of the player’s capsule, or, flying, the eyes. The rooms’ fences come first, so the first ID is the room there wherever a room holds the position; several come back where fences overlap, like on the plane of a wall two rooms share or in a fence that is no room’s, like the gallery’s lobby-north within the Lobby. A player outside of every fence stays in the room entered last, which this tool does not tell. A fence relating to another holds wherever that one does. Fence IDs are what dump_geofences lists with their boxes and relations. Read-only: does not move the player, change focus or simulate input.',
      inputSchema: {
        type: 'object',
        properties: {
          position: {
            type: 'object',
            description: 'world-space point in meters. Default: the player’s place',
            properties: {
              x: {type: 'number'},
              y: {type: 'number'},
              z: {type: 'number'},
            },
            required: ['x', 'y', 'z'],
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!isRecord(input) || Object.keys(input).some(key => key !== 'position')) {
          throw new TypeError('This tool takes an object with an optional position.')
        }
        const {position} = input
        if (position !== undefined && !isCoordinates(position, 'x,y,z')) {
          throw new TypeError('position must be {x, y, z}, three finite numbers in world meters.')
        }
        return getBridge().getGeofences({position: position as GeofenceQuery['position']})
      },
    },
    {
      name: 'show_fence',
      title: 'Show geofence outlines',
      description: 'Outline geofences whose IDs match a minimatch pattern, or show all fences. IDs are listed by dump_geofences. Outlines are blue, or red for every fence containing the player. Lines show through walls and stay open at unbounded ends. They fade with weighted camera distance. The page’s line_style (barycentric or aliased) and line_width control the outlines. Changes the selection made by ?show_fence for this page and returns the new selection. A pattern matching no fences leaves the selection unchanged and reports an error.',
      inputSchema: {
        type: 'object',
        properties: {
          fence: {
            type: ['boolean', 'string'],
            minLength: 1,
            description: 'a minimatch pattern over fence IDs, like {lobby,lodge*}, true for all (the default) or false to hide the outlines',
          },
        },
        additionalProperties: false,
      },
      annotations: {readOnlyHint: false},
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!isRecord(input) || Object.keys(input).some(key => key !== 'fence')) {
          throw new TypeError('This tool takes an object with an optional fence.')
        }
        const {fence = true} = input
        if (typeof fence !== 'boolean' && (typeof fence !== 'string' || !fence)) {
          throw new TypeError('fence must be a nonempty minimatch pattern, true for all or false for none.')
        }
        return getBridge().showFence({fence})
      },
    },
    {
      name: 'add_layer',
      title: 'Create a drawing layer',
      description: 'Create a page-local drawing layer and return its ID. Only id is required; it must not exist already. Defaults to white, priority 0, the live overlay line width and style, and no distance fade. Higher priority draws on top. Use the returned ID as drawing.layer in add_drawing.',
      inputSchema: layerSchema,
      annotations: {readOnlyHint: false},
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        return {id: getBridge().addLayer(readLayer(input))}
      },
    },
    {
      name: 'clear_layer',
      title: 'Clear one drawing layer',
      description: 'Remove every drawing on the named layer and return the number removed. Keeps its definition. Built-in layers are default, fences (blue), touching-fences (red), portrait-slots, lamps and ambience-emitters. The gallery also has sloperator-sightings.',
      inputSchema: {
        type: 'object',
        properties: {id: layerIdSchema},
        required: ['id'],
        additionalProperties: false,
      },
      annotations: {readOnlyHint: false},
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!isRecord(input) || Object.keys(input).length !== 1 || !isLayerId(input.id)) {
          throw new TypeError('Expected {id} for one layer.')
        }
        return {removed: getBridge().clearLayer(input.id)}
      },
    },
    {
      name: 'clear_drawings',
      title: 'Clear all overlay drawings',
      description: 'Remove every drawing across all layers, including geofence outlines, and return the number removed. Layer IDs and settings remain available for new drawings.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: {readOnlyHint: false},
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!isRecord(input) || Object.keys(input).length) {
          throw new TypeError('Expected an empty object to clear all drawings.')
        }
        return {removed: getBridge().clearDrawings()}
      },
    },
    {
      name: 'add_drawing',
      title: 'Add an overlay drawing',
      description: 'Draw a world-space line, axis-aligned box outline, point marker, triangle perimeter, circle or sphere outline in meters. Use drawing.layer to select an existing overlay layer (default: default). The optional hex RGB color overrides the layer’s; a circle is horizontal unless given a normal. A sphere takes center and radius and its outline stays round from every view. A camera_facing_rectangle takes a world center and full width and height in meters. A viewport_rectangle takes x and y from the top left and width and height, all in fractions of the active viewport; it ignores world depth and distance fade. Independent of show_fence and included in captures. For world-space shapes the layer’s obstructedOpacityFactor scales the opacity of pixels behind depth-writing surfaces. The drawing stays until cleared or the page reloads. Returns its ID and geometry.',
      inputSchema: {
        type: 'object',
        properties: {drawing: drawingSchema},
        required: ['drawing'],
        additionalProperties: false,
      },
      annotations: {readOnlyHint: false},
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!isRecord(input) || Object.keys(input).length !== 1 || !Object.hasOwn(input, 'drawing')) {
          throw new TypeError('Expected an object with one drawing.')
        }
        return getBridge().addDrawing(readDrawing(input.drawing))
      },
    },
    {
      name: 'add_text_overlay',
      title: 'Add a text label',
      description: 'Place a plain-text HTML label at fixed viewport CSS pixels. Omit position for the viewport center, use {x, y} for pixels from the top left or {x, y, z} to project a world point once through the current camera and canvas. Returns {added: false} if the world point is outside the view. Anchor selects which point on the label meets the position. Labels appear in browser screenshots but not download_frame.',
      inputSchema: {
        type: 'object',
        properties: {
          anchor: {
            type: 'integer',
            minimum: 1,
            maximum: 9,
            default: 5,
            description: 'Reading order: 1/2/3 across the top, 4/5/6 across the middle and 7/8/9 across the bottom. Default 5 (center).',
          },
          text: {
            type: 'string',
            pattern: String.raw`\S`,
          },
          position: {
            type: 'object',
            properties: {
              x: {type: 'number'},
              y: {type: 'number'},
              z: {type: 'number'},
            },
            required: ['x', 'y'],
            additionalProperties: false,
          },
        },
        required: ['text'],
        additionalProperties: false,
      },
      annotations: {readOnlyHint: false},
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!isRecord(input) || typeof input.text !== 'string' || !input.text.trim() || Object.keys(input).some(key => key !== 'text' && key !== 'position' && key !== 'anchor')) {
          throw new TypeError('Expected nonblank text with optional position and anchor.')
        }
        const {anchor, position} = input
        if (anchor !== undefined && !(typeof anchor === 'number' && Number.isInteger(anchor) && anchor >= 1 && anchor <= 9)) {
          throw new TypeError('anchor must be an integer from 1 to 9.')
        }
        if (position !== undefined && !isCoordinates(position, 'x,y') && !isCoordinates(position, 'x,y,z')) {
          throw new TypeError('position must be {x, y} in viewport CSS pixels or {x, y, z} in world meters.')
        }
        return getBridge().addTextOverlay(input as TextOverlayInput)
      },
    },
    {
      name: 'clear_text_overlay',
      title: 'Clear text labels',
      description: 'Remove all labels added by add_text_overlay on this page and return the number removed. Leaves drawings and other HTML alone.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: {readOnlyHint: false},
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!isRecord(input) || Object.keys(input).length) {
          throw new TypeError('Expected an empty object to clear text labels.')
        }
        return {removed: getBridge().clearTextOverlay()}
      },
    },
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
            description: 'm/s it leaves with toward a portrait or a target. Default: how fast the player throws it standing still, by its mass, 10 for an orb',
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
            description: 'the kind of orb, like horror, spook, halloween, impasto, paint or transparent',
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
      name: 'spawn_party_effect',
      title: 'Spawn party effect',
      description: 'Play a party effect anywhere in the world: one of the special effects that burst out of a fusion’s portal as the result of an orb’s fusion flips out and out of the alchemy machine’s cannon, like bats, blood or ghosts, or that only play where they are spawned, like staring eyes or flesh tendrils, here on its own, bursting out of a point, facing a level direction, over the floor under it, with its sound while the sound is on. It renders from the next frame on and leaves the world a moment after it is over. Fails for an unknown effect, whose error lists the effects. Returns the effect, where it bursts out, its rotation, the height of the floor under it and the seconds it goes on. Does not move the player, change focus or simulate input.',
      inputSchema: {
        type: 'object',
        properties: {
          effect: {
            type: 'string',
            description: 'the id of the party effect: bats, blood, eyes, ghosts, smears, strokes or tendrils',
          },
          position: point('world-space point in meters it bursts out of, [x, y, z], like the middle of a portal, about 1.8 m over the floor'),
          rotation: {
            type: 'number',
            description: 'the way it faces, as a turn around the y axis in radians: toward +z at 0, toward +x at a quarter turn, like a portrait’s rotation. Default: 0',
          },
          floor: {
            type: 'number',
            description: 'world-space height in meters of the floor under it, which what it spills lands on. Default: the floor the world has under the position',
          },
          delay: {
            type: 'number',
            description: 'seconds until it bursts out, which it waits hidden while its pipelines compile. Default: 0',
            minimum: 0,
          },
        },
        required: ['effect', 'position'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !partyKeys.has(key))) {
          throw new TypeError('This tool takes an object with effect, position and optional rotation, floor and delay.')
        }
        const {effect, position, rotation, floor, delay} = input as Record<string, unknown>
        if (typeof effect !== 'string' || !effect) {
          throw new TypeError('effect must be the id of a party effect.')
        }
        if (!isPoint(position)) {
          throw new TypeError('position must be three finite numbers.')
        }
        for (const [key, value] of [['rotation', rotation], ['floor', floor]] as const) {
          if (value !== undefined && !(typeof value === 'number' && Number.isFinite(value))) {
            throw new TypeError(`${key} must be a finite number.`)
          }
        }
        if (delay !== undefined && !(typeof delay === 'number' && Number.isFinite(delay) && delay >= 0)) {
          throw new TypeError('delay must be a finite number of at least 0.')
        }
        return getBridge().spawnPartyEffect({
          effect,
          position,
          rotation: rotation as number | undefined,
          floor: floor as number | undefined,
          delay,
        })
      },
    },
    {
      name: 'spawn_sloperator',
      title: 'Spawn the Sloperator',
      description: 'Bring the Sloperator, the bowler-hatted gentleman of the gallery’s icon, to one of his sights right away and keep him there wherever the player goes, for debugging, snaps and films, which fly the player out of the fence he is seen from. Without a sight, it brings him to the sight of every fence of his the player’s place is in, like get_geofences tells, which does nothing outside of all of them and in a world without him. Forgets that the player caught sight of him there and the Slop he left there, if any, and places him the way entering the sight’s fence does: on his seat where it stood when the game began, on it where it went if it was pushed or turned a little, standing where it stood once it is gone, or on his spot; anything else in the box he takes up from his neutral pose through his sight pose keeps him away (state kept_away). He stays until the player leaves the sight’s fence after catching sight of him, which leaves his Slop there as ever, or this tool brings him there anew. While rooms still load, which holds the physics still, it places him on its first step once they are in, like entering the fence then. Resolves once he is drawn there, so trigger_sloperator_sighting can follow right away, or once something keeps him away. Logs gallery.sloperator_spawn like entering the fence. Fails for a sight that is unknown or in a room this page’s ?world_reach leaves out, whose error lists the sights, and for a sight in a world without him. Returns what dump_sloperator tells about each sight it brought him to now, an empty array where it did nothing. Sights: lodge_east_armchair, lodge_west_armchair, lobby_east_bench, lobby_north_bench, salon_ottoman and exhibition_glass. Does not move the player, change focus or simulate input.',
      inputSchema: {
        type: 'object',
        properties: {
          sight: {
            type: 'string',
            description: 'the id of the sight, like lobby_east_bench. Default: the sight of every fence of his the player’s place is in',
          },
        },
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!isRecord(input) || Object.keys(input).some(key => key !== 'sight')) {
          throw new TypeError('This tool takes an object with an optional sight.')
        }
        const {sight} = input
        if (sight !== undefined && (typeof sight !== 'string' || !sight)) {
          throw new TypeError('sight must be the id of a sight of the Sloperator.')
        }
        return getBridge().spawnSloperator({sight})
      },
    },
    {
      name: 'trigger_sloperator_sighting',
      title: 'Trigger a Sloperator sighting',
      description: 'Have the player catch sight of the Sloperator at one of his sights where he is now, as if aiming at him zoomed in all the way with nothing but glass in between, which is the only way the game itself does: he moves from his neutral pose into his sight pose, getting up off his seat and standing in front of it, or, standing, spinning his cane up and bringing his hands behind his back (1.8 s off a seat, 1.5 s standing, on the frame clock), and leaves his Slop there once the player leaves the sight’s fence. With instant, he is in his sight pose right away, for snaps. Without a sight, it catches sight of him wherever he is drawn now and was not caught sight of yet, which does nothing where there is no such sight and in a world without him. Logs gallery.sloperator_sight with how far the middle of him was from the camera and where the camera was. Fails for a sight that is unknown or out of reach, where he is not now (spawn_sloperator brings him there) and where the player caught sight of him already, and for a sight in a world without him. Returns each sighting: sight, pose, distance in meters and the camera’s position in world meters, an empty array where it did nothing. Does not move the player, change focus or simulate input.',
      inputSchema: {
        type: 'object',
        properties: {
          sight: {
            type: 'string',
            description: 'the id of the sight, like lobby_east_bench. Default: every sight he is drawn at and was not caught sight of yet',
          },
          instant: {
            type: 'boolean',
            description: 'whether he is in his sight pose right away instead of moving into it. Default: false',
          },
        },
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!isRecord(input) || Object.keys(input).some(key => !sightingKeys.has(key))) {
          throw new TypeError('This tool takes an object with an optional sight and an optional instant.')
        }
        const {instant, sight} = input
        if (sight !== undefined && (typeof sight !== 'string' || !sight)) {
          throw new TypeError('sight must be the id of a sight of the Sloperator.')
        }
        if (instant !== undefined && typeof instant !== 'boolean') {
          throw new TypeError('instant must be true or false.')
        }
        return getBridge().triggerSloperatorSighting({
          sight,
          instant,
        })
      },
    },
    {
      name: 'cast_mood',
      title: 'Cast mood',
      description: 'Hold a mood over the world from now on as if its prop were held, like ?mood does from the start: it fades in at its own pace over whatever the room casts, once the mood cast before it has gone, and stays until this tool casts another one or, with null, none, which lets it fade out. Film recipes run it through their tools keyframes to show a mood coming and going. Fails for an unknown mood, whose error lists the moods. Returns the mood held now, its title and the seconds it takes to come and to go. Does not move the player, change focus or simulate input.',
      inputSchema: {
        type: 'object',
        properties: {
          mood: {
            type: ['string', 'null'],
            description: 'the id of the mood, like paint, horror or fusion, or null to hold none anymore',
          },
        },
        required: ['mood'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join(',') !== 'mood') {
          throw new TypeError('This tool takes an object with mood.')
        }
        const {mood} = input as Record<string, unknown>
        if (mood !== null && (typeof mood !== 'string' || !mood)) {
          throw new TypeError('mood must be the id of a mood or null.')
        }
        return getBridge().castMood({mood})
      },
    },
    {
      name: 'set_graphics_quality',
      title: 'Set graphics quality',
      description: 'Switch the graphics of this session like the menu’s Graphics button does, to fast, heavy or cinematic by name, or with null back to the ones the page started with: what ?graphics asked for, fast without it. Resolves once the scene has switched, while what it builds anew, like shadow maps and pipelines, may still load, which get_loading_items lists; render a few frames before capturing, so shadow maps and temporal antialiasing settle. Film recipes run it through their tools keyframes to switch graphics mid-flight. Fails for unknown graphics, whose error lists them, and for cinematic on a page not opened with ?graphics=cinematic, whose renderer lacks the GPU limits they need. Returns the graphics from now on, the previous ones and the initial ones. Does not move the player, change focus or simulate input.',
      inputSchema: {
        type: 'object',
        properties: {
          quality: {
            type: ['string', 'null'],
            description: 'fast, heavy or cinematic, or null for the graphics the page started with',
          },
        },
        required: ['quality'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join(',') !== 'quality') {
          throw new TypeError('This tool takes an object with quality.')
        }
        const {quality} = input as Record<string, unknown>
        if (quality !== null && (typeof quality !== 'string' || !quality)) {
          throw new TypeError('quality must be the name of the graphics or null.')
        }
        return getBridge().setGraphicsQuality({quality})
      },
    },
    {
      name: 'reroll_seed',
      title: 'Reroll seed',
      description: 'Build the world anew from a newly rolled seed, like the menu’s Reroll seed button: on a page opened with ?seed, go to the same URL with a newly rolled ?seed in its place, which leaves the stored seed and its game alone, so the next page’s menu offers to continue it; otherwise forget the stored seed and reload, so the next page rolls one for a new game and greets with the first menu. Rolled seeds range from 1 to 9999. Returns how it goes (via url or storage), the seed this page is built from (previous), the seed of the next page, null where the next page rolls it itself, and with ?seed the URL it goes to. The page leaves right after answering, which ends this session and everything this page held that is not stored, like imported works, and the tools register anew once the next page has loaded.',
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
        if (!isRecord(input) || Object.keys(input).length) {
          throw new TypeError('This tool takes an empty input object.')
        }
        return getBridge().rerollSeed()
      },
    },
    {
      name: 'set_seed',
      title: 'Set seed',
      description: 'Build the world anew from a seed of your own, the way the menu’s Reroll seed button goes over to a rolled one: on a page opened with ?seed, go to the same URL with this ?seed in its place, which leaves the stored seed and its game alone; otherwise store the seed as the game’s and reload, so the next page continues a game of that seed and its menu offers to continue it. Seed 0 asks for the default environment, which skips the rolls that have a default. Returns how it goes (via url or storage), the seed this page is built from (previous), the seed of the next page and with ?seed the URL it goes to. The page leaves right after answering, even for the seed it already has, which ends this session and everything this page held that is not stored, like imported works, and the tools register anew once the next page has loaded.',
      inputSchema: {
        type: 'object',
        properties: {
          seed: {
            type: 'integer',
            description: `the seed to build the next page from, from 0 to ${maximumSeed}, like the 1 to 9999 the game rolls`,
            minimum: 0,
            maximum: maximumSeed,
          },
        },
        required: ['seed'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!isRecord(input) || Object.keys(input).join(',') !== 'seed') {
          throw new TypeError('This tool takes an object with seed.')
        }
        const {seed} = input
        if (!isSeed(seed)) {
          throw new TypeError(`seed must be an integer from 0 to ${maximumSeed}.`)
        }
        return getBridge().setSeed({seed})
      },
    },
    {
      name: 'add_portrait',
      title: 'Add portrait',
      description: 'Bring an image into the world as an imported work: cropped to its middle if wider than 2:1 or taller than 1:2, in its own aspect, right away without the hanging animation or the sound of an arrival. Its target is exactly one of a portrait slot, where it hangs in place of the work hanging there, if any, whatever its size; a spot on a wall, where it hangs if it fits, its placard below it or else above it; or a world position, where it enters the world loose, upright and facing +z, and falls like a work the player dropped. Unless told a frame and a size, it wears its id’s roll of the frames of the slot or of the room it arrives in, at the slot’s frame area or that room’s. Its image uses the page’s ?new_canvas_material if set, otherwise the canvas_material specified here. Without either it shows flat. Resolves once it is in the collection, while its image may still decode. Fails for an unknown slot, wall, frame or canvas material, whose errors say what there is, a slot, a wall or a position in a room this page’s ?world_reach leaves out, a position outside of the world, a spot on a wall it does not fit at, with the reason, an id a work already has, an image that does not load or is no PNG, JPEG, WebP, AVIF or GIF up to 25 mb, and a full collection. Returns its id, its title, whether it hangs, the slot and the wall if any, the id of the work it replaced, the frame it wears unless the default one, its canvas material if it has one, where its frame’s middle is, its rotation, its frame width and height in meters and its frame area in cm². Slot ids are what dump_portrait_slots lists, which names their walls too. Does not move the player, change focus or simulate input.',
      inputSchema: {
        type: 'object',
        properties: {
          image: {
            type: 'string',
            description: 'URL of the image, which the page fetches',
          },
          target: {
            description: 'where it goes: {slot}, {wall_id, position} or {position}',
            oneOf: [
              {
                type: 'object',
                properties: {
                  slot: {
                    type: 'string',
                    description: 'id of the portrait slot it hangs in',
                    minLength: 1,
                  },
                },
                required: ['slot'],
                additionalProperties: false,
              },
              {
                type: 'object',
                properties: {
                  wall_id: {
                    type: 'string',
                    description: 'id of the wall it hangs on, like banquet-south',
                    minLength: 1,
                  },
                  position: {
                    type: 'object',
                    description: 'the middle of its frame on the wall, in meters: x along the wall from its middle, to the right as seen from its room, and y above its foot',
                    properties: {
                      x: {type: 'number'},
                      y: {type: 'number'},
                    },
                    required: ['x', 'y'],
                    additionalProperties: false,
                  },
                },
                required: ['wall_id', 'position'],
                additionalProperties: false,
              },
              {
                type: 'object',
                properties: {
                  position: {
                    type: 'object',
                    description: 'the world-space middle of its frame in meters, where it enters the world loose',
                    properties: {
                      x: {type: 'number'},
                      y: {type: 'number'},
                      z: {type: 'number'},
                    },
                    required: ['x', 'y', 'z'],
                    additionalProperties: false,
                  },
                },
                required: ['position'],
                additionalProperties: false,
              },
            ],
          },
          title: {
            type: 'string',
            description: 'its title. Default: the image’s file name without its extension, dashes and underscores as spaces, as an import names it, or “An untitled arrival” for a data or blob URL, which names no file',
            minLength: 1,
            maxLength: 150,
          },
          id: {
            type: 'string',
            description: 'its id, unique in the collection, which tells the same roll of frames every time, for it and for the result of a fusion that takes it. Default: a new one',
            pattern: workIdPattern.source,
          },
          frame: {
            type: 'string',
            description: 'id of the frame it wears, like classic, louis or travertine. Default: its id’s roll of the frames of the slot, or else of the room the target lies in',
            minLength: 1,
          },
          canvas_material: {
            type: 'string',
            enum: [...canvasMaterialIds],
            description: 'id of the canvas material its image is on, the surface it is painted or printed on: linen (loom linen), impasto (knife impasto), nacre (abalone ground), rag (cold-press rag), wax (beeswax veil), baryta (satin baryta), moire (watered silk) or karakami (karakami mica). Overridden by ?new_canvas_material. Default: none (flat image)',
          },
          size: {
            type: 'number',
            description: 'its frame area in cm², like 15000, which its own aspect divides into width and height. Default: the slot’s, or else that of the room the target lies in',
            exclusiveMinimum: 0,
          },
        },
        required: ['image', 'target'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute: (input: unknown, {signal}) => {
        signal.throwIfAborted()
        if (!isRecord(input) || Object.keys(input).some(key => !portraitKeys.has(key))) {
          throw new TypeError('This tool takes an object with image, target and an optional title, id, frame, canvas_material and size.')
        }
        const {image, target, title, id, frame, canvas_material: canvasMaterial, size} = input
        if (typeof image !== 'string' || !URL.canParse(image, typeof location === 'undefined' ? undefined : location.href)) {
          throw new TypeError('image must be the URL of an image.')
        }
        if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.length > 150)) {
          throw new TypeError('title must be a text of 1 to 150 characters.')
        }
        if (id !== undefined && (typeof id !== 'string' || !workIdPattern.test(id))) {
          throw new TypeError(`id must match ${workIdPattern}.`)
        }
        if (frame !== undefined && (typeof frame !== 'string' || !frame)) {
          throw new TypeError('frame must be the id of a frame.')
        }
        if (canvasMaterial !== undefined && !isCanvasMaterialId(canvasMaterial)) {
          throw new TypeError(`canvas_material must be one of ${canvasMaterialIds.join(', ')}.`)
        }
        if (size !== undefined && !(typeof size === 'number' && Number.isFinite(size) && size > 0)) {
          throw new TypeError('size must be a finite number of cm² above 0.')
        }
        return getBridge().addPortrait({
          image,
          target: readPortraitTarget(target),
          title,
          id,
          frame,
          canvasMaterial,
          size,
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
