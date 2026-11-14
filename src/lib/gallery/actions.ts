import type {PartyEffectId, PartyOptions, PartyPlacement} from '#src/party_effects/index.ts'
import type {FusionImpact} from './fusion/Fusion.ts'
import type {Portrait, ThrownItem, Vec3} from './types.ts'
import type {Voice} from 'procedural-audio'

import composeId from 'compose-id'
import {defaultEgoOptions} from 'ego-player/motor'

import {moodSuppressionKey, toggleMoodSuppression} from '#src/moods/lib/moodSuppression.ts'
import world from '#src/worlds/current.ts'

import aimDot from '../aimDot.ts'
import SoundEngine from '../audio/SoundEngine.ts'
import {writeStored} from '../browserStorage.ts'
import crosshair, {crosshairToggleKey} from '../crosshair.ts'
import {isDevelopmentMode} from '../developmentMode.ts'
import {environmentSeed} from '../gameSeed.ts'
import {hiddenUiKey, toggleHiddenUi} from '../hiddenUi.ts'
import pauseMenu from '../pauseMenu.ts'
import {graphicsTuningKey, toggleGraphicsTuning} from '../rendering/customGraphics.ts'
import {bookmarkKey, teleportToNextBookmark} from './bookmarks.ts'
import {flyModeKey, toggleFlyMode} from './flyMode.ts'
import {useGallery} from './store.ts'

const {spawn: playerSpawn} = world
export const cameraPose = {
  focused: false,
  /** whether a capture posed the camera apart from the player (`slopGallery.pose`) until the next teleport, which makes the room the camera is in the player’s, so the world looks and sounds as it does there */
  posed: false,
  position: [playerSpawn.position[0], playerSpawn.position[1] + 1.6, playerSpawn.position[2]] as Vec3,
  direction: [-Math.sin(playerSpawn.yaw) * Math.cos(playerSpawn.pitch), Math.sin(playerSpawn.pitch), -Math.cos(playerSpawn.yaw) * Math.cos(playerSpawn.pitch)] as Vec3,
}
/** the player’s capsule: its middle, which decides the room the player is in, its height, standing or crouching, whether it stands on something and how fast it actually moves, in m/s */
export const bodyPose = {
  center: [playerSpawn.position[0], playerSpawn.position[1] + defaultEgoOptions.height / 2, playerSpawn.position[2]] as Vec3,
  grounded: true,
  height: defaultEgoOptions.height,
  radius: defaultEgoOptions.radius,
  velocity: [0, 0, 0] as Vec3,
}
export function setCameraFocused(focused: boolean) {
  cameraPose.focused = focused
  aimDot.setBlocked('viewing', focused)
}

export const dragPose = {
  active: false,
  x: 0,
  y: 0,
}
export const galleryEvents = new EventTarget
let noticeTimer: ReturnType<typeof setTimeout>

/** a party effect asked for by {@link spawnPartyEffect} */
export type PartyEffectRequest = {
  effect: PartyEffectId
  options?: PartyOptions
  placement: PartyPlacement
}

export function notify(notice: string) {
  useGallery.setState({notice})
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => useGallery.setState({notice: ''}), 6500)
}

export function enterGallery() {
  if (!useGallery.getState().ready) {
    return
  }
  galleryEvents.dispatchEvent(new Event('cancel-view'))
  void SoundEngine.get().resume().catch(() => notify('Audio could not be enabled.'))
  void pauseMenu.enter().catch(() => {})
}

export function chime(frequency = 320) {
  if (useGallery.getState().sound) {
    SoundEngine.get().tone(frequency)
  }
}

/** Plays the sound effect of the catalog with the id in the world, unless the sound is off. */
export function playEffect(id: string) {
  if (useGallery.getState().sound) {
    const engine = SoundEngine.get()
    engine.playEffect(id, engine.world)
  }
}

/** Plays a recipe in the world, heard from `position` if given, unless the sound is off. */
export function playSound(voices: ReadonlyArray<Voice>, seed: string, position?: Vec3) {
  if (useGallery.getState().sound) {
    SoundEngine.get().playInWorld(voices, seed, position)
  }
}

export function narrate(id: string) {
  void SoundEngine.get().resume().catch(() => notify('Audio could not be enabled.'))
  galleryEvents.dispatchEvent(new CustomEvent('narrate', {detail: id}))
}

/** Records a successful V-view of a portrait, its name plate or another inspectable object. */
export function inspect(id: string) {
  useGallery.getState().markInteracted(id)
  useGallery.setState({inspecting: id})
  galleryEvents.dispatchEvent(new CustomEvent('inspect', {detail: id}))
}

export function narrateModel(id: string) {
  void SoundEngine.get().resume().catch(() => notify('Audio could not be enabled.'))
  galleryEvents.dispatchEvent(new CustomEvent('narrate-model', {detail: id}))
}

export function stopNarration() {
  galleryEvents.dispatchEvent(new Event('stop-narration'))
}

/** Flings the player’s body off with the velocity, in m/s, replacing its momentum. */
export function flingPlayer(velocity: Vec3) {
  galleryEvents.dispatchEvent(new CustomEvent('fling', {detail: velocity}))
}

/**
 * Plays a party effect (`src/party_effects`), like `blood`, anywhere in the world on its own: bursting out of the placement’s position, facing the way its rotation turns it around y, toward +z at 0 like a work on a wall, over the floor the world has there unless the placement names its own, right away or after the options’ delay.
 * `PartyEffects`, in every world’s scene, plays it until it is over.
 */
export function spawnPartyEffect(effect: PartyEffectId, placement: PartyPlacement, options?: PartyOptions) {
  galleryEvents.dispatchEvent(new CustomEvent<PartyEffectRequest>('party-effect', {
    detail: {
      effect,
      placement,
      options,
    },
  }))
}

/** Asks for the hung portrait `first` to fuse with the loose portrait `second`, which struck it as `impact` says. */
export function requestFusion(first: string, second: string, impact?: FusionImpact) {
  galleryEvents.dispatchEvent(new CustomEvent('fusion', {detail: [first, second, impact]}))
}

/** Asks for the hung portrait `portrait` to fuse with the thrown `item`, which struck it as `impact` says. */
export function requestItemFusion(portrait: string, item: ThrownItem, impact?: FusionImpact) {
  galleryEvents.dispatchEvent(new CustomEvent('item-fusion', {
    detail: {
      portrait,
      item,
      impact,
    },
  }))
}

/** how something bouncing off a wall’s works is thrown back, in m/s: straight out from the wall by `out` and up by `lift`, like the player’s body knocking a work off its wall or an imported work that turns out not to fit where it was aimed */
export const wallRebound = {
  lift: 2,
  out: 3,
}

/** Knocks a hung work off its wall, keeping whatever the player holds. */
export function dropPortrait(id: string) {
  const state = useGallery.getState()
  const portrait = state.portraits.find(candidate => candidate.id === id)
  if (!portrait?.hung || portrait.reserved || portrait.fusing || state.held === id) {
    return false
  }
  const {held, placement: heldPlacement} = state
  // The frame faces +z before its yaw; it tips forward off the wall and falls.
  state.commit(state.portraits.map(candidate => (candidate.id === id ? {
    ...candidate,
    hung: false,
    wallId: undefined,
    orientation: undefined,
    velocity: [Math.sin(portrait.rotation) * 0.8, 0.4, Math.cos(portrait.rotation) * 0.8],
  } : candidate)))
  useGallery.setState({
    held,
    placement: heldPlacement,
  })
  chime(110)
  return true
}

export function viewPortrait(id: string) {
  if (!useGallery.getState().ready) {
    return
  }
  galleryEvents.dispatchEvent(new CustomEvent('view', {detail: id}))
}

export async function loadBlob(source: Blob | string) {
  if (source instanceof Blob) {
    return source
  }
  const response = await fetch(source)
  if (!response.ok) {
    throw new Error('The artwork could not be loaded.')
  }
  return response.blob()
}

/** The frame the work with the id `work` wears arriving at `position`, which `from` looks at, in the game of `seed`: its roll of the frames of the room it arrives in or, where that lies outside of every room, like beyond a wall, of the room it was made from. */
export function arrivalFrame(position: Vec3, from: Vec3, work: string, seed = environmentSeed) {
  return world.frameAt(world.roomAt(position) ? position : from, seed, work)
}

/** the id the next new work gets, drawn ahead so the placement preview of a dropped image can show the frame it will arrive in */
let upcomingId = composeId()

/** The id the next new work gets, see {@link takeWorkId}. */
export const upcomingWorkId = () => upcomingId

/** A new work 1.6 m in front of the pose, facing it, in the frame of the room it arrives in. */
export function newPortrait(source: Blob, title: string, width: number, height: number, pose: {
  direction: Vec3
  position: Vec3
} = cameraPose): Portrait {
  const d = pose.direction
  const p = pose.position
  const position: Vec3 = [p[0] + d[0] * 1.6, Math.max(world.placement.floorHeight([p[0] + d[0] * 1.6, p[1], p[2] + d[2] * 1.6]) + 0.8, p[1] + d[1] * 1.6), p[2] + d[2] * 1.6]
  const id = takeWorkId()
  const frame = arrivalFrame(position, p, id)
  return {
    id,
    title,
    creator: 'You · guest artist',
    description: 'A new arrival. Every collection starts with a little curiosity.',
    source,
    position,
    rotation: Math.atan2(-d[0], -d[2]),
    width,
    height,
    hung: false,
    imported: true,
    ...frame ? {frame} : {},
  }
}

export function isTextInput(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select'))
}

export function setApiKey(key: string) {
  if (!writeStored('apiKey', key || null)) {
    notify('Browser storage is unavailable. The key will only stay until the page closes.')
  }
  useGallery.setState({apiKey: key})
}

/** Switches the audio on or off as the player asked, which later visits start with unless `?audio` says otherwise. */
export function toggleSound() {
  const sound = !useGallery.getState().sound
  useGallery.setState({sound})
  writeStored('audio', String(sound))
}

export function handleGalleryKey(event: KeyboardEvent) {
  if (isTextInput(event.target) || event.defaultPrevented) {
    return
  }
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
    return
  }
  const s = useGallery.getState()
  if (event.code === 'KeyM') {
    toggleSound()
  }
  // The aim dot only shows while playing, so the toggle is limited to that too and gives immediate visual feedback.
  if (event.code === crosshairToggleKey && s.locked && !s.dragging) {
    crosshair.toggle()
  }
  if (event.code === 'F9' && isDevelopmentMode) {
    event.preventDefault()
    debugger
  }
  if (event.code === hiddenUiKey && isDevelopmentMode) {
    toggleHiddenUi()
  }
  if (event.code === graphicsTuningKey && isDevelopmentMode) {
    toggleGraphicsTuning()
  }
  if (event.code === moodSuppressionKey && isDevelopmentMode) {
    notify(toggleMoodSuppression() ? 'Moods suppressed. N lets them back.' : 'Moods are back.')
  }
  if (event.code === flyModeKey && isDevelopmentMode && s.locked) {
    notify(toggleFlyMode() ? 'Flying. W follows your gaze, Space and C rise and sink, F lands.' : 'Landed. Gravity is back.')
  }
  if (event.code === bookmarkKey && isDevelopmentMode && s.locked) {
    teleportToNextBookmark(event.shiftKey)
  }
}

export async function importDroppedFiles(files: Array<File>, x: number, y: number) {
  const s = useGallery.getState()
  return s.importFiles?.(files, s.importTarget?.(x, y))
}

/** The id for a new work, the one {@link upcomingWorkId} told, drawing the next. */
function takeWorkId() {
  const id = upcomingId
  upcomingId = composeId()
  return id
}
