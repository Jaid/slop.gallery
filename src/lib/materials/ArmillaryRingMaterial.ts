import StudioEnvironment from 'knot-materials/StudioEnvironment.ts'
import {atan, color, exp, float, max, mix, mx_noise_float, positionGeometry, uniform, vec2} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {armillaryBand} from '../gallery/moonfall/ArmillaryBandGeometry.ts'
import {heightNormal, inside, line, visibleDetail} from './filters.ts'

/**
 * A ring of the orbital sculpture as an engraved armillary band of `armillaryBandGeometry`: dark bronze, its outer and inner faces graduated in degrees like an astronomical instrument, with longer ticks every 5° and 10°, a mark every 30° and a rule along either side of the scale.
 *
 * The engraving is filled with a luminous inlay in the ring’s `hue`, which flares in a comet’s tail behind the bead the way the glowing tube did; the narrow edges glow faintly too, so the ring still draws its circle in the dark room. `phaseAt` places the bead every frame, from 0 to 1 round the ring from +x. The degrees are laid out in meters of arc, so the lines keep their width on every ring.
 */
export default class ArmillaryRingMaterial extends MeshStandardNodeMaterial {
  private readonly studio = new StudioEnvironment

  constructor(radius: number, hue: number, phaseAt: () => number) {
    super({
      metalness: 1,
      roughness: 0.38,
      envMapIntensity: 0.6,
    })
    this.name = 'Armillary band'
    this.envMap = this.studio
    const p = positionGeometry
    const turn = atan(p.y, p.x).div(Math.PI * 2).fract()
    const phase = uniform(0).onRenderUpdate(phaseAt)
    const tail = exp(phase.sub(turn).fract().mul(-14)).mul(2.6)
    const across = p.z
    const broad = p.xy.length().sub(radius).abs().greaterThan(armillaryBand.thickness / 2 - 0.0005).select(float(1), float(0))
    const degrees = turn.mul(360)
    /** the distance along the ring to the nearest mark every `step` degrees */
    const arc = (step: number) => degrees.div(step).add(0.5).fract().sub(0.5).mul(step * Math.PI / 180 * radius)
    const half = armillaryBand.width / 2
    const tick = (step: number, from: number, width: number) => line(arc(step), width).mul(across.smoothstep(from - 0.0006, from + 0.0006))
    const scale = across.lessThan(half * 0.78).and(across.greaterThan(-half * 0.55)).select(float(1), float(0))
    const ticks = max(max(tick(1, half * 0.4, 0.0007), tick(5, half * 0.05, 0.0009)), tick(10, -half * 0.35, 0.001)).mul(scale)
    const rules = max(line(across.sub(half * 0.78), 0.0007), line(across.add(half * 0.55), 0.0007))
    const marks = inside(vec2(arc(30), across.add(half * 0.32)).length().sub(0.0028))
    const inlay = max(max(ticks, rules), marks).mul(broad)
    // From afar the fine lines fade to a faint glow instead of shimmering.
    const shown = inlay.mul(visibleDetail(across.fwidth(), 0.0012).mul(0.7).add(0.3))
    const patina = mx_noise_float(p.mul(11)).mul(0.5).add(0.5)
    const glow = tail.add(0.9)
    this.colorNode = mix(mix(color('#4a3a28'), color('#2c2b26'), patina), color(hue).mul(0.3), shown)
    this.roughnessNode = float(0.34).add(patina.mul(0.16)).add(shown.mul(0.3))
    this.emissiveNode = color(hue).mul(shown.mul(glow).mul(3.2).add(broad.oneMinus().mul(glow).mul(1.1)))
    this.normalNode = heightNormal(inlay.mul(-0.00025))
  }

  override dispose() {
    this.studio.dispose()
    super.dispose()
  }
}
