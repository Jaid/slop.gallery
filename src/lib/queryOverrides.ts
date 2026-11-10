import {readMood} from '#src/moods/lib/forcedMood.ts'
import {readItems} from '#src/worlds/sandbox/items.ts'
import {readTurntable} from '#src/worlds/sandbox/turntable.ts'

import {readAiSettings} from './ai/settings.ts'
import {readShowAmbienceEmitters} from './audio/ambience/ambienceEmitters.ts'
import {readAudio} from './audio/audioParameter.ts'
import {readIntroNarration} from './audio/intro.ts'
import {readCrosshair} from './crosshair.ts'
import {readDevelopmentMode} from './developmentMode.ts'
import {readSeedOverride} from './environmentSeed.ts'
import {readFade} from './fade.ts'
import {readFrame} from './frames/frameParameter.ts'
import {readFrozenTime} from './frozenTime.ts'
import {readPortraitSet} from './gallery/defaultPortraits.ts'
import {readFlying} from './gallery/flyMode.ts'
import {readDownload, readWebhook, readWebhookEndpoint} from './gallery/fusion/resultSharing.ts'
import {readWeather} from './gallery/lighting.ts'
import {readPortraitSlotEditing, readShowPortraitSlots} from './gallery/portraitSlotStore.ts'
import {readRoom, readSpawn} from './gallery/spawn.ts'
import {readKnotRotation} from './physics/rotatingKnots.ts'
import {readShowSticky} from './placement/showSticky.ts'
import {readAlbedo} from './rendering/albedo.ts'
import {readAntiAliasing} from './rendering/antiAliasing.ts'
import {readFov} from './rendering/fov.ts'
import {readGraphicsModeName} from './rendering/graphicsMode.ts'
import {readEditLamps, readShowLamps} from './rendering/lightLevels.ts'
import {readNear} from './rendering/near.ts'
import {readPmrem} from './rendering/pmrem.ts'
import {readRatio} from './rendering/ratio.ts'
import {readScale, readWarmupScale} from './rendering/scale.ts'
import {readShowWireframe} from './rendering/showWireframe.ts'
import {readStreamBudget} from './rendering/streamBudget.ts'
import {readWireframeHighlight} from './rendering/wireframeHighlight.ts'
import {readRoomAnnouncements} from './roomAnnouncements.ts'
import {readDumpScreenshot} from './telemetry/dumpScreenshot.ts'
import {readTelemetry} from './telemetry/telemetryParameter.ts'

type Reader = (input: string) => unknown

// read-permalink resolves relative input against the current page, so defaults need an absolute URL without parameters.
const defaultsUrl = 'http://localhost/'
const searchParameters = (input: string) => {
  const url = new URL(input, defaultsUrl)
  return url.searchParams
}
const searchParameter = (key: string): Reader => input => searchParameters(input).get(key) ?? undefined
const readers: Record<string, Reader> = {
  ...Object.fromEntries(Object.keys(readAiSettings(defaultsUrl)).map(key => [key, (input: string) => readAiSettings(input)[key as keyof ReturnType<typeof readAiSettings>]])),
  // Only whether a key was given, which never leaves the page.
  openrouter_key: input => {
    const key = readAiSettings(input).openrouter_key
    return typeof key === 'string' ? 'redacted' : key
  },
  albedo: readAlbedo,
  anti_aliasing: readAntiAliasing,
  audio: readAudio,
  crosshair: readCrosshair,
  development: readDevelopmentMode,
  download: readDownload,
  dump_screenshot: readDumpScreenshot,
  edit_lamps: readEditLamps,
  edit_portrait_slots: readPortraitSlotEditing,
  fade: readFade,
  flying: readFlying,
  fov: readFov,
  frame: readFrame,
  frozen_time: readFrozenTime,
  graphics: readGraphicsModeName,
  intro_narration: readIntroNarration,
  // A list, which compares by its ids, joined as the query gives them.
  item: input => readItems(input).join(','),
  knot_rotation: readKnotRotation,
  mood: readMood,
  near: readNear,
  pmrem: readPmrem,
  portrait_set: readPortraitSet,
  ratio: readRatio,
  room: readRoom,
  room_announcements: readRoomAnnouncements,
  scale: readScale,
  seed: readSeedOverride,
  show_ambience_emitters: readShowAmbienceEmitters,
  show_lamps: readShowLamps,
  show_portrait_slots: readShowPortraitSlots,
  show_sticky: readShowSticky,
  show_wireframe: readShowWireframe,
  spawn: readSpawn,
  stream_budget: readStreamBudget,
  warmup_scale: readWarmupScale,
  weather: readWeather,
  wireframe_highlight: readWireframeHighlight,
  telemetry: readTelemetry,
  turntable: input => readTurntable(input)?.artwork,
  turntable_area: input => readTurntable(input)?.area,
  turntable_ratio: input => readTurntable(input)?.aspect,
  webhook: readWebhook,
  // Only the origin, as webhook URLs often carry their token in the path or the query, like Discord’s.
  webhook_endpoint: input => {
    const endpoint = readWebhookEndpoint(input)
    return endpoint && URL.parse(endpoint)?.origin
  },
  logs_ingestion_endpoint: searchParameter('logs_ingestion_endpoint'),
  metrics_ingestion_endpoint: searchParameter('metrics_ingestion_endpoint'),
  traces_ingestion_endpoint: searchParameter('traces_ingestion_endpoint'),
}

/** Every query parameter the app reads, apart from the `data` permalink payload. */
export const queryParameters = Object.keys(readers)

/** Query parameters of the page that differ from their defaults: known parameters as the app normalizes them, unknown ones as given. `undefined` when everything is at its default. */
export default function readQueryOverrides(href = typeof location === 'undefined' ? defaultsUrl : location.href): Record<string, boolean | number | string> | undefined {
  const overrides: Record<string, boolean | number | string> = {}
  for (const [key, read] of Object.entries(readers)) {
    const value = read(href)
    if (value !== undefined && !Object.is(value, read(defaultsUrl))) {
      overrides[key] = value as boolean | number | string
    }
  }
  // `data` carries an encoded permalink payload whose fields the readers above already cover.
  for (const [key, value] of searchParameters(href)) {
    if (!(key in readers) && key !== 'data') {
      overrides[key] = value
    }
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined
}
