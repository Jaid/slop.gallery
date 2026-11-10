import type {Triple} from '../../../lib/Triple.ts'

import {cameraViewMatrix, vec3} from 'three/tsl'

const toView = (direction: Triple) => vec3(...direction).normalize().transformDirection(cameraViewMatrix)
/** Directions of the gallery's real light sources, rotated into view space so analytic highlights line up with the environment reflections and with the scene's key light: the warm softbox, the cool strip and the fill panel of the studio environment, plus the key spot. */
export const warmSoftboxView = toView([-0.238, -0.637, -0.733])
export const coolStripView = toView([0.59, -0.309, 0.554])
export const fillPanelView = toView([-0.278, -0.287, 0.591])
export const keyLightView = toView([-3, 9, -16])
export const studioLightsView = [keyLightView, warmSoftboxView, coolStripView, fillPanelView] as const
