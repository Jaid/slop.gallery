import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, max, mix, mx_noise_float, mx_worley_noise_float, mx_worley_noise_vec2, normalWorldGeometry, positionLocal, time, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {moonfallCrater} from '../gallery/moonfall/config.ts'
import {heightNormal, inside, visibleDetail} from './filters.ts'

type Float = Node<'float'>

const unit = (node: Float) => node.mul(0.5).add(0.5)
const regolith = {
  dark: hsl.integer(85, 6, 26),
  body: hsl.integer(85, 7, 36),
  fresh: hsl.integer(89, 9, 51),
  melt: hsl.integer(68, 3, 10),
}

/**
 * The Moonfall crater’s regolith, and the ejecta blocks strewn over it with `rock`.
 *
 * Mapped in the crater’s own frame, its middle at the origin, so the pattern knows where the impact struck. Fresh, bright ejecta streak out from the middle in rays that fade toward the rim, and the steep walls show brighter, freshly slumped material with darker streaks running down them, while the flat floor around the central peak is a pond of dark impact melt, glassy and smoother, split into polygons by cooling cracks. Everywhere the dust is strewn with small pebbles and grit and broad, soft patches of mature, darker soil.
 *
 * The ejecta blocks are dark breccia: angular pale clasts set in a basaltic matrix pitted by gas bubbles, their upward faces dusted with regolith. Pebbles, grit and cracks fade to their average before they could shimmer.
 */
export default class CraterMaterial extends MeshStandardNodeMaterial {
  constructor({lava = hsl.integer(38, 100, 63), rock = false}: {
    /** the color of the melt still glowing deep in the pond’s cracks */
    lava?: number
    /** dresses the ejecta blocks instead of the terrain */
    rock?: boolean
  } = {}) {
    super({
      roughness: 0.96,
      envMapIntensity: 0.08,
    })
    const p = positionLocal
    const footprint = max(p.x.fwidth(), p.z.fwidth()).max(p.y.fwidth()).toVar('craterFootprint')
    const detail = visibleDetail(footprint, 0.04)
    const fine = visibleDetail(footprint, 0.012)
    const up = normalWorldGeometry.y
    // Broad patches of older, darker soil and fresher, paler soil.
    const maturity = unit(mx_noise_float(p.xz.mul(0.45))).mul(0.65).add(unit(mx_noise_float(p.xz.mul(1.7).add(9.1))).mul(0.35))
    const grit = mix(float(0.5), unit(mx_noise_float(p.mul(55))), fine)
    // Pebbles: a scatter of small stones, each its own shade, with a rim of shadow on the side away from the light.
    const pebbleCells = mx_worley_noise_vec2(p.xz.mul(16))
    // Most cells hold no pebble; they gather in loose drifts.
    const pebbleSize = unit(mx_noise_float(p.xz.mul(1.6).add(3.7))).smoothstep(0.62, 0.9).mul(unit(mx_noise_float(p.xz.mul(11).add(1.3))).mul(0.14).add(0.06))
    const pebble = inside(pebbleCells.x.sub(pebbleSize).div(16)).mul(detail).toVar('craterPebble')
    const pebbleShade = unit(mx_noise_float(p.xz.mul(6).add(4.2)))
    const dust = mix(color(regolith.dark), color(regolith.body), maturity).mul(grit.sub(0.5).mul(0.22).add(1))
    if (rock) {
      // Breccia: pale angular clasts in a dark, vesicular matrix.
      // Warped, so the clasts break into angular shards instead of round blobs.
      const warped = p.mul(22).add(vec3(mx_noise_float(p.mul(30)), mx_noise_float(p.mul(30).add(3)), mx_noise_float(p.mul(30).add(6))).mul(0.35))
      const clastSize = unit(mx_noise_float(p.mul(3).add(8.8))).smoothstep(0.35, 0.8).mul(0.22)
      const clasts = inside(mx_worley_noise_float(warped).sub(clastSize).div(22)).mul(detail)
      const clastTone = unit(mx_noise_float(p.mul(9).add(2.1)))
      const matrix = mix(color(hsl.integer(92, 4, 25)), color(hsl.integer(81, 6, 32)), unit(mx_noise_float(p.mul(7))))
      const vesicles = unit(mx_noise_float(p.mul(120))).smoothstep(0.72, 0.8).mul(fine)
      let stone: Node<'vec3'> = mix(matrix, mix(color(hsl.integer(85, 11, 53)), color(hsl.integer(88, 12, 65)), clastTone), clasts.mul(0.8))
      stone = stone.mul(vesicles.mul(-0.5).add(1)).mul(grit.sub(0.5).mul(0.16).add(1))
      // Fine regolith settles on whatever faces up.
      const dusted = up.smoothstep(0.35, 0.85).mul(0.75)
      this.colorNode = mix(stone, dust, dusted)
      this.roughnessNode = mix(float(0.82).add(vesicles.mul(0.1)), float(0.97), dusted)
      this.normalNode = heightNormal(grit.mul(0.0012).sub(vesicles.mul(0.0015)).add(clasts.mul(0.0008)).mul(detail))
      return
    }
    const radius = vec2(p.x, p.z).length()
    const t = radius.div(moonfallCrater.radius).toVar('craterT')
    const direction = vec2(p.x, p.z).div(radius.max(0.001))
    // Rays: bright ejecta thrown out in narrow streaks, strongest on the upper walls and the rim. Sampled on the unit circle, so they have no seam.
    const angle = atan(p.z, p.x)
    const rayField = unit(mx_noise_float(vec3(direction.mul(6.5), t.mul(1.2)))).mul(0.6).add(unit(mx_noise_float(vec3(direction.mul(19), t.mul(2.5).add(3)))).mul(0.4))
    const rays = rayField.smoothstep(0.55, 0.7).mul(t.smoothstep(0.25, 0.7)).mul(t.smoothstep(1, 0.88)).toVar('craterRays')
    // The steep walls slump: fresh, bright material with darker streaks running straight downslope.
    const steep = up.smoothstep(0.92, 0.55)
    const downslope = unit(mx_noise_float(vec2(angle.mul(28), t.mul(4)))).mul(unit(mx_noise_float(vec2(angle.mul(9), t.mul(1.5).add(7)))))
    const slumpStreaks = downslope.smoothstep(0.3, 0.55).mul(steep)
    // The floor around the central peak holds a pond of dark, glassy impact melt, cracked into polygons as it cooled.
    const floorDepth = p.y.negate().div(moonfallCrater.depth)
    const pond = floorDepth.smoothstep(0.86, 0.93).mul(t.smoothstep(0.34, 0.26)).mul(up.smoothstep(0.85, 0.97)).toVar('craterMelt')
    const crackCells = mx_worley_noise_vec2(p.xz.mul(2.2).add(vec2(mx_noise_float(p.xz.mul(1.3)), mx_noise_float(p.xz.mul(1.3).add(5))).mul(0.25)))
    const crackDistance = crackCells.y.sub(crackCells.x).div(2.2)
    const cracks = inside(crackDistance.sub(0.012)).mul(visibleDetail(footprint, 0.02)).mul(pond)
    const flowRipples = unit(mx_noise_float(vec2(radius.mul(14), angle.mul(3)))).mul(fine)
    let surface: Node<'vec3'> = dust
    surface = mix(surface, color(regolith.fresh).mul(grit.sub(0.5).mul(0.2).add(1)), steep.mul(0.4))
    surface = surface.mul(slumpStreaks.mul(-0.35).add(1))
    surface = mix(surface, color(regolith.fresh).mul(1.2), rays.mul(0.85))
    surface = mix(surface, color(regolith.melt).mul(flowRipples.mul(0.15).add(0.93)), pond.mul(0.9))
    surface = surface.mul(cracks.mul(-0.7).add(1))
    // Pebbles in their own shades, a little paler than the dust they sit in.
    surface = mix(surface, mix(color(hsl.integer(85, 6, 25)), color(hsl.integer(85, 8, 45)), pebbleShade), pebble.mul(pond.oneMinus()))
    this.colorNode = surface
    this.roughnessNode = mix(float(0.97).sub(grit.mul(0.04)), float(0.3).add(flowRipples.mul(0.12)), pond).add(cracks.mul(0.4)).min(1)
    // Deep in the cracks the melt is still cooling: a dull glow that swells and ebbs slowly, unevenly along every crack.
    const embers = unit(mx_noise_float(vec3(p.xz.mul(1.6), time.mul(0.12)))).mul(0.7).add(unit(time.mul(0.6).add(radius.mul(1.3)).sin()).mul(0.3))
    const crackHeat = inside(crackDistance.sub(0.009)).mul(pond).mul(visibleDetail(footprint, 0.03))
    this.emissiveNode = color(lava).mul(crackHeat.mul(embers.smoothstep(0.2, 0.85)).mul(4))
    const height = grit.mul(0.0015).add(pebble.mul(0.006)).sub(cracks.mul(0.004)).add(flowRipples.mul(0.0012).mul(pond))
    this.normalNode = heightNormal(height.mul(detail))
  }
}
