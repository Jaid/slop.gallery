import type {SoftShadow} from '#src/lib/rendering/shadowFilterNodes.ts'

/** How a fusion portal’s light blurs the shadows it casts: 3° wide as seen from it, the same width wherever they fall, over 16 shadow map lookups per pixel. */
const portalShadow: Readonly<SoftShadow> = {
  blurAngle: 3 * Math.PI / 180,
  softSamples: 16,
}

export default portalShadow
