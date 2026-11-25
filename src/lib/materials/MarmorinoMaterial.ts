import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, max, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from './filters.ts'

type Float = Node<'float'>

const unit = (node: Float) => node.mul(0.5).add(0.5)

/**
 * Marmorino: lime plaster with marble dust, troweled on in thin coats and burnished to a soft polish, for the Antechamber.
 *
 * Every coat went on in short, overlapping trowel strokes, each sweep at an angle of its own, and every stroke left a patch a shade lighter or darker than the one below, so the wall clouds in soft, layered sweeps like stone seen under water. The edges of the strokes show as faint ridges, burnishing polished some sweeps to a waxy gloss and left others matte, and the marble dust sparkles in fine, pale specks. Under the thin wax the wall reflects the colored light from the dome as soft smears instead of a mirror.
 *
 * Mapped along whichever wall it covers, by world position. Specks and ridges fade to their average before they could shimmer.
 */
export default class MarmorinoMaterial extends MeshPhysicalNodeMaterial {
  constructor({tint = hsl.integer(91, 33, 85)}: {
    /** the plaster’s tint */
    tint?: number
  } = {}) {
    super({
      roughness: 0.4,
      envMapIntensity: 0.6,
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
    })
    const n = normalWorldGeometry
    const u = select(n.x.abs().greaterThan(n.z.abs()), positionWorld.z, positionWorld.x).toVar('marmorinoU')
    const y = positionWorld.y.toVar('marmorinoY')
    const footprint = max(u.fwidth(), y.fwidth()).toVar('marmorinoFootprint')
    const fine = visibleDetail(footprint, 0.004)
    const ridgeDetail = visibleDetail(footprint, 0.01)
    // Three coats of strokes, each sweeping at its own angle; a stroke is a patch of a stretched noise, longer than it is wide.
    const coats = [
      {
        angle: 0.35,
        scale: 2.2,
        seed: 1.7,
        shade: 0.06,
      },
      {
        angle: -0.8,
        scale: 3.1,
        seed: 5.3,
        shade: -0.05,
      },
      {
        angle: 1.25,
        scale: 4.3,
        seed: 9.1,
        shade: 0.04,
      },
    ]
    let tone: Node<'float'> = float(1)
    let polish: Node<'float'> = float(0)
    let ridges: Node<'float'> = float(0)
    for (const {angle, scale, seed, shade} of coats) {
      const a = u.mul(Math.cos(angle)).add(y.mul(Math.sin(angle)))
      const b = y.mul(Math.cos(angle)).sub(u.mul(Math.sin(angle)))
      const wobble = mx_noise_float(vec3(a.mul(scale * 0.7), b.mul(scale * 0.7), seed + 20)).mul(0.25)
      const field = unit(mx_noise_float(vec3(a.mul(scale * 0.55), b.mul(scale * 1.9).add(wobble), seed)))
      const stroke = field.smoothstep(0.48, 0.6)
      tone = tone.add(stroke.mul(shade))
      polish = polish.add(unit(mx_noise_float(vec3(a.mul(scale * 0.4), b.mul(scale * 1.4), seed + 40))).smoothstep(0.45, 0.65).mul(0.4))
      // The trowel’s edge leaves a faint ridge where the stroke ends.
      ridges = ridges.add(field.sub(0.54).abs().smoothstep(0, 0.012).oneMinus().mul(ridgeDetail).mul(0.5))
    }
    // Broad, soft clouding underneath the strokes, where the base coat dried unevenly.
    const clouds = unit(mx_noise_float(vec3(u.mul(0.6), y.mul(0.6), 3.3)))
    const dust = unit(mx_noise_float(positionWorld.mul(700))).smoothstep(0.8, 0.88).mul(fine)
    const pits = unit(mx_noise_float(positionWorld.mul(420).add(9))).smoothstep(0.86, 0.93).mul(fine)
    const base = color(tint)
    let plaster: Node<'vec3'> = base.mul(tone.add(clouds.sub(0.5).mul(0.08)))
    plaster = mix(plaster, color(hsl.integer(88, 37, 94.5)), dust.mul(0.5)).mul(pits.mul(-0.25).add(1)).mul(ridges.mul(-0.05).add(1))
    this.colorNode = plaster
    const burnished = polish.clamp(0, 1)
    this.roughnessNode = float(0.55).sub(burnished.mul(0.35)).add(pits.mul(0.3)).sub(dust.mul(0.1))
    this.clearcoatNode = burnished.mul(0.35).add(0.05)
    this.clearcoatRoughnessNode = float(0.4).sub(burnished.mul(0.22))
    // A hand-troweled wall undulates gently; the ridges stand a hair proud of it.
    const undulation = mx_noise_float(vec3(u.mul(1.8), y.mul(1.8), 7.7)).mul(0.0006)
    this.normalNode = heightNormal(undulation.add(ridges.mul(0.00006)).sub(pits.mul(0.0001)))
  }
}
