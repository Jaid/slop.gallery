import type {OrbitSettings} from '#src/lib/camera/OrbitInspection.ts'
import type {Portrait, Vec3} from './types.ts'

import {portraitFrame} from '#src/frames/index.ts'
import {inspectionFov} from '#src/lib/camera/OrbitInspection.ts'

import {portraitLabelLayout} from './portraitLabel.ts'

/**
 * Orbiting a hung portrait starts straight in front of it, its image filling the view at the inspection field of view as far as its frame leaves it in sight, so none of the frame shows along the view’s tighter sides. Inspecting the
 * name plate frames the portrait and its plate together, with room around both. The orbit stays in front
 * of the wall.
 */
export default function portraitOrbit(portrait: Portrait, label: boolean, aspect: number): {
  center: Vec3
  orbit: OrbitSettings
} {
  const layout = portraitLabelLayout(portrait.width, portrait.height, portrait.labelAbove)
  const bottom = label ? Math.min(-portrait.height / 2, layout.bottom) : -portrait.height / 2
  const top = label ? Math.max(portrait.height / 2, layout.top) : portrait.height / 2
  const normal: Vec3 = [Math.sin(portrait.rotation), 0, Math.cos(portrait.rotation)]
  const frame = portraitFrame(portrait.frame)
  const distance = label ? Math.max(top - bottom + 0.4, portrait.width / aspect) / (2 * Math.tan(inspectionFov * Math.PI / 360)) * 1.14 : frame.viewingDistance(portrait.width, portrait.height, aspect, inspectionFov)
  const {imageDepth} = frame
  return {
    // Measured from the image, not the frame’s middle behind it, which would crop the image’s edges.
    center: [portrait.position[0] + normal[0] * imageDepth, portrait.position[1] + (top + bottom) / 2, portrait.position[2] + normal[2] * imageDepth],
    orbit: {
      radius: Math.hypot(portrait.width, top - bottom) / 2,
      // The wall around the artwork stays sharp.
      blur: 0,
      distance,
      facing: normal,
      yawLimit: 1.2,
      pitchLimit: 0.9,
    },
  }
}
