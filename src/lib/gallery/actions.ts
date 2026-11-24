import type {PartyEffectId, PartyOptions, PartyPlacement} from '#src/party_effects/index.ts'
import type {FusionImpact} from './fusion/Fusion.ts'
import type {Portrait, ThrownItem, Vec3} from './types.ts'
import type {Voice} from 'procedural-audio'

import composeId from 'compose-id'
import {defaultEgoOptions} from 'ego-player/motor'

import readCanvasMaterialParameters from '#src/canvas_materials/lib/canvasMaterialParameters.ts'
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
import {fovKeys} from '../rendering/fov.ts'
import {toggleWorldTuning, worldTuningKey} from '../worldTuning/panel.ts'
import {viewTuning} from '../worldTuning/ViewTuningModule.ts'
import {bookmarkKey, teleportToNextBookmark} from './bookmarks.ts'
import {flyMode, flyModeKey, toggleFlyMode} from './flyMode.ts'
import {useIntro} from './intro.ts'
import {roundingKey, roundView} from './rounding.ts'
import {useGallery} from './store.ts'

const {spawn: playerSpawn} = world
export const cameraPose = {
  focused: false,
  position: [playerSpawn.position[0], playerSpawn.position[1] + 1.6, playerSpawn.position[2]] as Vec3,
  direction: [-Math.sin(playerSpawn.yaw) * Math.cos(playerSpawn.pitch), Math.sin(playerSpawn.pitch), -Math.cos(playerSpawn.yaw) * Math.cos(playerSpawn.pitch)] as Vec3,
}
/**
 * The player’s capsule: its middle, whether it flies, out of the physics, its height, standing or crouching, whether it stands on something and how fast it actually moves, in m/s.
 * Its `place` is where the player is, which decides the room the player is in and the fences crossed: the capsule’s middle, or, flying, the eyes, below which the capsule only hangs, through the floor wherever they skim it.
 */
export const bodyPose = {
  center: [playerSpawn.position[0], playerSpawn.position[1] + defaultEgoOptions.height / 2, playerSpawn.position[2]] as Vec3,
  flying: false,
  grounded: true,
  height: defaultEgoOptions.height,
  place: [playerSpawn.position[0], playerSpawn.position[1] + defaultEgoOptions.height / 2, playerSpawn.position[2]] as Vec3,
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

/** where a flight takes the player, see {@link flyPlayer} */
export type Flight = {
  /** where the eyes go, in world meters */
  position?: Vec3
  /** the way they look, as a quaternion [x, y, z, w] */
  rotation?: [number, number, number, number]
}

export function notify(notice: string) {
  useGallery.setState({notice})
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => useGallery.setState({notice: ''}), 6500)
}

/**
 * Lets the player into the ready world, which asks for the pointer lock, so call it from a user gesture.
 * From the pause menu that Escape or `?paused` opened over the intro, it only gives the intro’s menu back, behind which the camera circles on from where it stood.
 */
export function enterGallery() {
  if (!useGallery.getState().ready) {
    return
  }
  if (useIntro.getState().orbit && pauseMenu.unpause()) {
    return
  }
  galleryEvents.dispatchEvent(new Event('cancel-view'))
  void SoundEngine.get().resume().catch(() => notify('Audio could not be enabled.'))
  void pauseMenu.enter().catch(() => {})
}

/**
 * Turns the menu before the game into the Escape key’s pause menu, which freezes the ready world behind it, a camera circling on the intro’s orbit included, until {@link enterGallery} resumes.
 * The menus of a game already left, the pause menu itself and a world that hasn’t loaded stay as they are.
 */
export function pauseGallery() {
  const {locked, stage} = pauseMenu.getSnapshot()
  if (!useGallery.getState().ready || locked || stage === 'pause' || stage === 'unfocus') {
    return
  }
  pauseMenu.pause()
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

/** Marks the work with the id as one the player has interacted with, on the work itself or on its name plate; other ids, like a prop’s, mark nothing. */
export function markPortraitInteracted(id: string) {
  const state = useGallery.getState()
  if (state.portraits.some(portrait => portrait.id === id && !portrait.interacted)) {
    state.update(id, {interacted: true})
  }
}

export function narrate(id: string) {
  void SoundEngine.get().resume().catch(() => notify('Audio could not be enabled.'))
  galleryEvents.dispatchEvent(new CustomEvent('narrate', {detail: id}))
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
 * Makes the player fly, like `?flying` does, and puts its eyes at the flight’s position, looking the way its rotation turns them, each as it is unless given: anywhere, also inside walls and outside of the world, as a flying body is out of the physics.
 * This is how a camera moves freely: there is none apart from the player, so the room the eyes are in is the player’s, and the world looks and sounds as it does there.
 */
export function flyPlayer(flight: Flight = {}) {
  flyMode.active = true
  galleryEvents.dispatchEvent(new CustomEvent<Flight>('fly', {detail: flight}))
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

/** A new work 1.6 m in front of the pose, facing it, in the frame of the room it arrives in, which nobody has told anything about yet: no title, creator, description or year until its flavor text is written. */
export function newPortrait(source: Blob, width: number, height: number, pose: {
  direction: Vec3
  position: Vec3
} = cameraPose): Portrait {
  const d = pose.direction
  const p = pose.position
  const position: Vec3 = [p[0] + d[0] * 1.6, Math.max(world.placement.floorHeight([p[0] + d[0] * 1.6, p[1], p[2] + d[2] * 1.6]) + 0.8, p[1] + d[1] * 1.6), p[2] + d[2] * 1.6]
  const id = takeWorkId()
  const frame = arrivalFrame(position, p, id)
  const {new_canvas_material: canvasMaterial} = readCanvasMaterialParameters()
  return {
    id,
    source,
    position,
    rotation: Math.atan2(-d[0], -d[2]),
    width,
    height,
    hung: false,
    imported: true,
    ...canvasMaterial ? {canvasMaterial} : {},
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
  if (event.code === 'Escape') {
    pauseGallery()
  }
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
  if (event.code === worldTuningKey && isDevelopmentMode) {
    toggleWorldTuning()
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
  if (event.code === roundingKey && isDevelopmentMode && s.locked) {
    roundView()
  }
  const fovDirection = fovKeys[event.code]
  // A camera taken from the player, like V-viewing’s or the intro’s, would ease back to the field of view it found.
  if (fovDirection && isDevelopmentMode && !cameraPose.focused) {
    notify(`Field of view ${viewTuning.stepFov(fovDirection)}°.`)
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
