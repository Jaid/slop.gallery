import {abs, clamp, color, float, max, mix, mx_noise_float, mx_worley_noise_float, vec2} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, line, visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {along, assembleFrame, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, repeatPhase} from '../lib/materials/carving.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import FrameMetalMaterial, {brass} from '../lib/materials/FrameMetalMaterial.ts'
import frameStudio from '../lib/materials/frameStudio.ts'
import FrameWoodMaterial, {walnut} from '../lib/materials/FrameWoodMaterial.ts'
import {dome} from '../lib/ornaments.ts'

const imageDepth = -0.054
const wood = 0
const leather = 1
const metal = 2
const panel = {
  from: 0.01,
  to: 0.086,
  z: -0.046,
}
/** a walnut fillet at the sight edge, a flat panel of tooled leather, and a walnut ogee and cove at its outside */
const profile = FrameProfile.from([-0.005, imageDepth], wood)
  .line(-0.005, -0.043)
  .line(0.008, -0.043)
  .line(panel.from, panel.z, {material: leather})
  .line(panel.to, panel.z - 0.002)
  .line(0.088, -0.044, {material: wood})
  .ogee(0.11, -0.028, {
    reverse: true,
    steps: 10,
  })
  .arc(0.122, -0.066, -0.25, {steps: 6})
  .line(0.122, frameBack)
  .line(-0.005, frameBack)
const stud = () => dome(0.0045, 0.0035, {
  segments: 6,
  rings: 2,
})

/** The Sienna’s: a walnut frame round a panel of tooled and gilded Spanish leather, studded with brass nails along both its edges. */
export default class LeatherFrame extends PortraitFrame {
  override readonly description = 'Rich textures and questionable company: a panel of Spanish guadamecí, oxblood leather embossed with a Moorish interlace and gilded on its raised strapwork, its ground punched with a fine stipple, nailed down with two rows of brass studs between a walnut fillet and a walnut ogee.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#5a1a12'
  override readonly title = 'Tooled guadamecí'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [metal, place(stud(), along(halfWidth, halfHeight, panel.from + 0.006, panel.z, {
        spacing: 0.055,
        inset: 0.012,
        limit: 22,
      }))],
      [metal, place(stud(), along(halfWidth, halfHeight, panel.to - 0.006, panel.z - 0.002, {
        spacing: 0.055,
        inset: 0.012,
        limit: 26,
      }))],
    ])
  }

  protected override createMaterials() {
    return [new FrameWoodMaterial({
      timber: walnut,
      gloss: 0.4,
    }), new TooledLeatherMaterial, new FrameMetalMaterial({metal: brass})]
  }
}

/**
 * Spanish guadamecí: oxblood leather embossed with a Moorish interlace of circles and lozenges and gilded on its raised strapwork, its ground punched with a fine stipple, worn darker where hands have rested.
 */
class TooledLeatherMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.6,
      envMap: frameStudio,
      envMapIntensity: 0.9,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
    const {t} = band(surface, panel.from, panel.to)
    const phase = repeatPhase(surface, panel.to - panel.from, (panel.from + panel.to) / 2)
    const q = vec2(phase.mul(2).sub(1), t.mul(2).sub(1))
    const ring = line(q.length().sub(0.62), 0.07)
    const lozenge = line(abs(q.x).add(abs(q.y)).sub(0.95), 0.06)
    const corner = line(vec2(abs(q.x).sub(1), abs(q.y).sub(1)).length().sub(0.42), 0.06)
    const knot = line(q.length().sub(0.18), 0.05)
    const strap = clamp(max(max(ring, lozenge), max(corner, knot)), 0, 1).toVar('strap')
    const stipple = mx_worley_noise_float(p.mul(1100)).smoothstep(0, 0.3).oneMinus().mul(visibleDetail(footprint, 0.0015))
    const rubbed = mx_noise_float(p.mul(12)).mul(0.5).add(0.5)
    const hide = mix(color('#5a1610'), color('#2c0907'), rubbed.mul(0.6)).mul(stipple.mul(-0.3).add(1))
    const gold = color('#c99a48')
    this.colorNode = mix(hide, gold, strap)
    this.metalnessNode = strap.mul(0.85)
    this.roughnessNode = mix(float(0.62).add(stipple.mul(0.15)), float(0.32), strap)
    this.normalNode = heightNormal(strap.mul(0.0009).sub(stipple.mul(0.00008)).add(mx_noise_float(p.mul(220)).mul(0.00003)))
  }
}
