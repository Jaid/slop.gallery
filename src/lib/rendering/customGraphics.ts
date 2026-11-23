import type {LightingTuning} from '../gallery/lighting.ts'
import type {LodgeFloorTuning} from '../gallery/lodgeFloorTuning.ts'
import type {RenderPipelineSettings} from './renderPipelineSettings.ts'

import {clamp} from 'math'
import {ACESFilmicToneMapping} from 'three/webgpu'
import {create} from 'zustand'

import {getLightingTuning, lightingPresets, useLighting} from '../gallery/lighting.ts'
import {getLodgeFloorTuning} from '../gallery/lodgeFloorTuning.ts'
import {getAntiAliasing} from './antiAliasing.ts'
import {readFov} from './fov.ts'
import {getGraphicsProfile, readCinematicGraphics} from './graphicsMode.ts'
import {getRenderPipelineSettings} from './renderPipelineSettings.ts'
import {readScale} from './scale.ts'

/** key that shows or hides the tuning panel with `?development` */
export const graphicsTuningKey = 'KeyG'

/** the game camera’s vertical field of view in degrees, before any zoom, unless `?fov` sets another, which moods and camera bookmarks then leave alone */
export const defaultFov = 65

/** the narrowest and widest field of view in degrees that the tuning panel and {@link stepFov} set */
export const fovLimits = [5, 120] as const

/** keys that narrow and widen the game camera’s field of view by {@link fovStep} with `?development`, see {@link stepFov}: plus magnifies like zooming in, minus shows more */
export const fovKeys: Partial<Record<string, -1 | 1>> = {
  NumpadAdd: -1,
  NumpadSubtract: 1,
}

/** degrees {@link stepFov} widens or narrows the field of view by */
export const fovStep = 5

/** How the camera sees and the canvas resolves: values outside the render pipeline that the tuning panel changes too. */
export type ViewTuning = {
  /** vertical field of view of the game camera in degrees */
  fov: number
  /** renderer pixels per physical display pixel */
  renderScale: number
  /** one of three’s tone mapping constants */
  toneMapping: number
}

/** everything the tuning panel changes: the render pipeline, the lighting of levels that follow it, the Lodge’s planks and the view */
export type CustomGraphics = LightingTuning & LodgeFloorTuning & RenderPipelineSettings & ViewTuning

/** The view a page starts with: the permalink’s field of view and scale and the tone mapping React Three Fiber sets up. */
export function getViewTuning(): ViewTuning {
  return {
    fov: readFov() ?? defaultFov,
    renderScale: readScale() ?? 1,
    toneMapping: ACESFilmicToneMapping,
  }
}

/** The pipeline of the page’s heavy graphics, heavy or cinematic, and the lighting of the preset the page starts with, which the panel starts from and resets to. */
export function getDefaultCustomGraphics(): CustomGraphics {
  return {
    ...getRenderPipelineSettings(getGraphicsProfile(true, readCinematicGraphics()), getAntiAliasing(true)),
    ...getLightingTuning(lightingPresets[useLighting.getState().preset]),
    ...getLodgeFloorTuning(),
    ...getViewTuning(),
  }
}

/** The tuning panel’s values, starting from the graphics mode’s own. They stay in effect while the panel is hidden, so hiding it never rebuilds the pipeline. */
export const useCustomGraphics = create<CustomGraphics>(() => getDefaultCustomGraphics())

/** Whether the tuning panel shows, and whether the pointer is over it, which hides the pause menu so the scene shows every change. */
export const useGraphicsTuning = create<{
  hovered: boolean
  open: boolean
}>(() => ({
  hovered: false,
  open: false,
}))

/** Shows the tuning panel or hides it. */
export function toggleGraphicsTuning() {
  useGraphicsTuning.setState(state => ({
    hovered: false,
    open: !state.open,
  }))
}

/**
 * Widens the panel’s field of view by {@link fovStep} degrees, or narrows it for a `direction` of −1, within {@link fovLimits}, returning the new one.
 * One beyond them, like a `?fov` of 2, only moves back toward them.
 */
export function stepFov(direction: -1 | 1) {
  const {fov} = useCustomGraphics.getState()
  const [narrowest, widest] = fovLimits
  const stepped = clamp(fov + direction * fovStep, Math.min(fov, narrowest), Math.max(fov, widest))
  useCustomGraphics.setState({fov: stepped})
  return stepped
}

/** The values a tunable pipeline follows: the panel’s, whether it shows or not. */
export function getTunedGraphics() {
  return useCustomGraphics.getState()
}

/** Calls `listener` with the tuned values whenever they change, returning the unsubscribe function. */
export function subscribeTunedGraphics(listener: (values: CustomGraphics) => void) {
  return useCustomGraphics.subscribe(listener)
}
