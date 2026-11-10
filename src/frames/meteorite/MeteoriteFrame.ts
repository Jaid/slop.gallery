import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_fractal_noise_float, mx_noise_float, select, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, line, visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

type Float = Node<'float'>

const imageDepth = -0.058
/** a slab of iron cut with a plain bevel at the sight edge, a broad face broken into two shallow facets, and a rounded outer edge where the fusion crust survives */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.05)
  .line(0.012, -0.036)
  .line(0.06, -0.03)
  .line(0.098, -0.04)
  .arc(0.112, -0.06, 0.35, {steps: 8})
  .line(0.114, frameBack)
  .line(-0.005, frameBack)
/** how the etched iron of each direction of plates takes the light: the share of its reflectance and its roughness */
const plateFinishes = [[1, 0.14], [0.62, 0.42], [0.8, 0.26]] as const
/** Moonfall’s: a slab of etched meteoric iron, its Widmanstätten pattern of crossing plates catching the light, a fusion crust on its outer edge. */
export default class MeteoriteFrame extends PortraitFrame {
  override readonly description = 'Out of the ordinary: a slab of meteoric iron, its faces cut, polished and etched to show the Widmanstätten pattern of nickel-iron plates crossing in three directions, each etched to a sheen of its own and outlined by bright ribbons, while the outer edge keeps the dark, rough fusion crust it burned through the sky with.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#7d8084'
  override readonly title = 'Meteoric iron'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new MeteoriteMaterial]
  }
}

/**
 * Meteoric iron cut and etched to show its Widmanstätten pattern: plates of kamacite in three directions crossing each other, where they cross the one lying higher in the iron showing, each direction etched to a sheen of its own, outlined by thin bright ribbons of taenite and filled between with dark, fine-grained plessite. The outer edge keeps the dark, rough fusion crust.
 */
class MeteoriteMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      metalness: 1,
      envMap: frameStudio,
      envMapIntensity: 1.2,
    })
    const surface = frameSurface()
    const position = surface.position
    const footprint = max(position.x.fwidth(), position.y.fwidth()).max(position.z.fwidth())
    const p = vec2(surface.along, surface.reach.add(position.z.mul(0.5))).div(0.02)
    const warp = mx_fractal_noise_float(vec3(p.mul(0.05), surface.member), 3).mul(0.4)
    let top: Float = float(-1)
    // Between the plates, the dark and finely mottled plessite.
    const mottle = mx_noise_float(position.mul(400)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.002))
    let brightness: Float = mottle.mul(0.15).add(0.22)
    let roughness: Float = float(0.5)
    let ribbons: Float = float(0)
    for (const [index, angle] of [0.3, 0.3 + Math.PI / 3, 0.3 + Math.PI * 2 / 3].entries()) {
      const across = p.x.mul(Math.cos(angle)).add(p.y.mul(Math.sin(angle))).add(warp)
      // Plates of uneven widths and spacings.
      const band = across.add(mx_noise_float(vec3(across.mul(0.1), index * 7.3, 1)).mul(0.7))
      const cell = band.fract()
      const plate = cell.smoothstep(0, 0.025).mul(cell.smoothstep(0.3, 0.275))
      const level = mx_noise_float(vec3(band.floor().mul(3.7), index * 11.1, 2)).mul(0.5).add(0.5)
      const shows = plate.greaterThan(0.5).and(level.greaterThan(top))
      const [reflectance, rough] = plateFinishes[index]
      brightness = select(shows, float(reflectance), brightness)
      roughness = select(shows, float(rough), roughness)
      top = select(shows, level, top)
      ribbons = max(ribbons, max(line(cell.sub(0.3), 0.012), line(cell.sub(0.012), 0.012)))
    }
    const visible = visibleDetail(footprint, 0.0015)
    const ribbon = ribbons.mul(visible)
    const crust = surface.reach.smoothstep(0.097, 0.104)
    const crustGrain = mx_noise_float(position.mul(180)).mul(0.5).add(0.5)
    const iron = mix(color('#3a3c3e'), color('#c9ccce'), mix(brightness, float(1), ribbon.mul(0.7)))
    this.colorNode = mix(iron, color('#1a1714').mul(crustGrain.mul(0.4).add(0.8)), crust)
    this.roughnessNode = mix(mix(roughness, float(0.08), ribbon), float(0.85), crust)
    this.metalnessNode = float(1).sub(crust.mul(0.8))
    this.normalNode = heightNormal(ribbon.mul(0.00002).add(crustGrain.mul(crust).mul(0.0005)))
  }
}
