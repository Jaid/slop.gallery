import {abs, clamp, float, max, min, select, smoothstep, vec3} from 'three/tsl'

import {line} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import FrameMetalMaterial, {blackAnodized} from '../lib/materials/FrameMetalMaterial.ts'
import FramePaintMaterial from '../lib/materials/FramePaintMaterial.ts'

const imageDepth = -0.054
const face = 0
const edge = 1
const plate = {
  from: 0.006,
  to: 0.072,
  z: -0.046,
}
/** a flat plate of matte black aluminium, its printed scales on it, in a slim anodized edge */
const profile = FrameProfile.from([-0.005, imageDepth], edge)
  .line(-0.005, -0.046)
  .line(plate.from, plate.z, {material: face})
  .line(plate.to, plate.z)
  .line(plate.to + 0.004, -0.05, {material: edge})
  .line(0.076, frameBack)
  .line(-0.005, frameBack)

/** The Exhibition’s: a frame like a forensic photograph’s, matte black with a printed millimeter scale along every edge, a photographic scale on one corner and a red evidence label. */
export default class EvidenceFrame extends PortraitFrame {
  override readonly description = 'Lit like evidence: a flat plate of matte black aluminium printed like a forensic photograph’s border, a white scale ticking off every half centimeter along the work’s edges, longer every five, the checkered L of a photographic scale on the lower left corner and a red evidence label stuck to the top right.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#151617'
  override readonly title = 'Forensic scale'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [
      new FramePaintMaterial({
        color: '#111214',
        roughness: 0.8,
        grime: 0,
        layers: surface => {
          const r = surface.reach.sub(plate.from)
          // Ticks every 5 mm from the work’s corner, longer every 25 mm, shortening into the gap at the miters.
          const fromCorner = surface.along.add(surface.openingHalf)
          const tick = line(fromCorner.div(0.005).add(0.5).fract().sub(0.5).mul(0.005), 0.0003)
          const major = fromCorner.div(0.025).add(0.5).fract().sub(0.5).abs().lessThan(0.04)
          const length = select(major, float(0.01), float(0.005))
          const ticks = tick.mul(smoothstep(0.0005, 0, r.sub(length)).mul(smoothstep(-0.0005, 0.0003, r))).mul(smoothstep(0.004, 0.008, surface.toCorner))
          const baseline = line(r.sub(0.0005), 0.00035).mul(smoothstep(0.004, 0.008, surface.toCorner))
          // A checkered L on the lower left corner: the corner of the bottom member, whose run ends at its left end.
          const lower = surface.member.round().equal(2).or(surface.member.round().equal(3))
          const corner = surface.toCorner
          const bar = r.greaterThan(0.024).and(r.lessThan(0.032)).and(corner.lessThan(0.12))
          const checker = surface.toCorner.div(0.01).floor().mod(2).abs().lessThan(0.5)
          const lMark = select(lower.and(bar).and(select(surface.member.round().equal(2), surface.along.greaterThan(0), surface.along.lessThan(0))), select(checker, float(1), float(0.08)), float(0))
          // The red label on the top member near its right end, ruled with white lines for its writing.
          const top = surface.member.round().equal(0)
          const labelX = surface.along.sub(surface.openingHalf).add(0.11)
          const label = select(top, smoothstep(0.001, 0, max(abs(labelX).sub(0.045), abs(r.sub(0.038)).sub(0.017))), float(0))
          const writing = line(r.sub(0.038).div(0.007).add(0.5).fract().sub(0.5).mul(0.007), 0.0006).mul(smoothstep(0.004, 0.006, min(abs(labelX).sub(0.04).negate(), abs(r.sub(0.038)).sub(0.014).negate()))).mul(label)
          return [
            {
              mask: clamp(max(ticks, baseline), 0, 1).mul(0.95),
              color: vec3(0.88, 0.88, 0.86),
              roughness: 0.6,
            },
            {
              mask: lMark,
              color: vec3(0.9, 0.9, 0.88),
              roughness: 0.6,
            },
            {
              mask: label,
              color: vec3(0.6, 0.04, 0.03),
              roughness: 0.5,
            },
            {
              mask: writing,
              color: vec3(0.85, 0.84, 0.8),
              roughness: 0.5,
            },
          ]
        },
      }),
      new FrameMetalMaterial({metal: blackAnodized}),
    ]
  }
}
