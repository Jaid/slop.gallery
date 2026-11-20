import type {Node} from 'three/webgpu'

import {DEGREES_TO_RADIANS as degrees} from 'math'
import {acos, asin, atan, color, float, max, min, mix, mx_noise_float, normalize, positionLocal, vec3} from 'three/tsl'
import {DoubleSide, MeshStandardNodeMaterial} from 'three/webgpu'

import antechamberDome, {antechamberWindowMask, antechamberWindows} from '../gallery/antechamberDome.ts'
import {inside} from './filters.ts'
import {goldReflectance} from './GoldMaterial.ts'

type Float = Node<'float'>

/** the angle between rings of stars, and roughly between stars along a ring */
const spacing = 4.6 * degrees

/**
 * The Antechamber’s dome painted as a starry vault, like the Sainte-Chapelle’s: ultramarine laid over the plaster in mottled coats and strewn with gilt eight-pointed stars in staggered rings, the windows ringed and the springing and oculus edged with gilt bands. The stars keep clear of the bands round the windows.
 *
 * Mapped by direction from the dome’s center, so every star keeps its size from the springing to the crown.
 */
export default class StarryVaultMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      side: DoubleSide,
      roughness: 0.85,
    })
    this.name = 'Starry vault'
    this.maskNode = antechamberWindowMask()
    const {radius, oculus} = antechamberDome
    const direction = normalize(positionLocal)
    const elevation = asin(direction.y.clamp(-1, 1))
    const azimuth = atan(direction.x, direction.z)
    // Staggered rings of stars, as many round each ring as fit at its height.
    const ring = elevation.div(spacing).floor()
    const ringElevation = ring.add(0.5).mul(spacing)
    const count = ringElevation.cos().mul(Math.PI * 2 / spacing).floor().max(1)
    const step = float(Math.PI * 2).div(count)
    const shift = ring.mod(2).mul(0.5)
    const slot = azimuth.div(step).add(shift).floor()
    const starAzimuth = slot.add(0.5).sub(shift).mul(step)
    const u = azimuth.sub(starAzimuth).mul(elevation.cos()).mul(radius)
    const v = elevation.sub(ringElevation).mul(radius)
    const angle = atan(v, u)
    const reach = u.mul(u).add(v.mul(v)).sqrt()
    const star = inside(reach.sub(angle.mul(4).cos().abs().pow(4).mul(0.055).add(0.022)))
    // Gilt bands round every window, at the springing and round the oculus.
    const toWindow = antechamberWindows().reduce<Float>((nearest, window) => min(nearest, acos(direction.dot(vec3(...window.direction)).clamp(-1, 1)).sub(window.radius)), float(10))
    const band = (distance: Float, from: number, to: number) => inside(distance.sub(to)).mul(inside(distance.sub(from).negate()))
    const windowBand = band(toWindow.mul(radius), 0.02, 0.075)
    const rule = band(toWindow.mul(radius), 0.1, 0.11)
    const springing = band(elevation.mul(radius), 0, 0.09)
    const crown = band(float(oculus * degrees).sub(elevation).mul(radius), 0, 0.09)
    const clear = toWindow.mul(radius).smoothstep(0.17, 0.2)
    const gilt = max(max(windowBand, rule), max(springing, crown)).max(star.mul(clear).mul(elevation.mul(radius).smoothstep(0.14, 0.16)))
    const coats = mx_noise_float(positionLocal.mul(2.5)).mul(0.5).add(0.5)
    const brush = mx_noise_float(positionLocal.mul(vec3(18, 40, 18))).mul(0.5).add(0.5)
    const blue = mix(color('#14215a'), color('#22388e'), coats.mul(0.7).add(brush.mul(0.15)))
    this.colorNode = mix(blue, vec3(...goldReflectance).mul(0.85), gilt)
    this.metalnessNode = gilt
    this.roughnessNode = mix(float(0.82).add(brush.mul(0.1)), float(0.32), gilt)
  }
}
