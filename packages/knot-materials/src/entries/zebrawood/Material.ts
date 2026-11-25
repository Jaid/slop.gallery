import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {environmentHighlight, studioSheen} from '../../candidates/deepseek/lib/environment.ts'
import {tubeTorus} from '../../candidates/deepseek/lib/tubeMetric.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/**
 * A single block of figured heartwood. Growth rings wrap the tube; a slow three-dimensional warp turns
 * them into cathedral arches, while medullary rays, open pores and a satin oil finish wait for close inspection.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const n = normalLocal.normalize()
    const baseNormal = transformNormalToView(n).normalize()
// Broad, slow figure moves the whole ring system; the finer term roughens each growth boundary.
    const figure = mx_fractal_noise_float(p.mul(2.05).add(vec3(3.1, -8.4, 1.7)), 3, 2.02, 0.52)
    const fineFigure = mx_fractal_noise_float(p.mul(7.1).add(13.8), 2, 2.1, 0.5)
    const ringCount = 15
    const arch = tube.x.mul(TAU * 3).sin().mul(1.15).add(tube.x.mul(TAU * 5).cos().mul(0.36))
    const ringPhase = tube.y.mul(ringCount).add(figure.mul(2.8)).add(fineFigure.mul(0.3)).add(arch)
    const ringLocal = ringPhase.fract()
    const ringFootprint = ringPhase.fwidth().max(0.0001)
    const resolved = ringFootprint.smoothstep(0.22, 0.9).oneMinus()
// Latewood is a narrow, darker band; earlywood is wide, warm and porous.
    const late = ringLocal.smoothstep(0.54, 0.7).mul(ringLocal.smoothstep(0.88, 1).oneMinus())
    const ringTransition = ringLocal.smoothstep(0.5, 0.62).mul(ringLocal.smoothstep(0.96, 1).oneMinus())
// Burl eyes: two quiet whorls where the grain curls around a sleeping bud.
    const eye = (center: Node<'vec2'>, radius: number) => {
      const d = vec2(tube.x.sub(center.x).add(0.5).fract().sub(0.5).mul(7.2), tube.y.sub(center.y).mul(0.82)).length()
      return d.div(radius).smoothstep(0.2, 1).oneMinus().mul(d.mul(95).add(figure.mul(2.2)).sin().mul(0.5).add(0.5))
    }
    const burl = eye(vec2(0.27, 0.42), 0.2).add(eye(vec2(0.73, 0.68), 0.14).mul(0.7)).mul(intimate.mul(0.8).add(0.2))
    const burlShade = burl.mul(0.45)
    const mottle = mx_fractal_noise_float(p.mul(3.7).add(22.4), 3, 2.03, 0.5).mul(0.5).add(0.5)
    const heart = mx_fractal_noise_float(p.mul(1.25).add(vec3(-5.8, 7.2, 0.4)), 2, 2.01, 0.6).mul(0.5).add(0.5)
    const latewood = mix(color(hsl.integer(49, 60, 5)), color(hsl.integer(40, 76, 16)), mottle)
    const earlywood = mix(color(hsl.integer(41, 83, 28)), color(hsl.integer(68, 72, 63)), mottle.mul(0.65).add(facing.mul(0.2)))
    const amber = mix(earlywood, latewood, late.mul(0.88).add(burlShade).clamp())
    const sapwood = mix(color(hsl.integer(60, 56, 44)), color(hsl.integer(76, 47, 76)), mottle)
    const heartBlend = heart.smoothstep(0.12, 0.72).mul(0.7)
    const sapDistance = tube.y.sub(0.82).add(0.5).fract().sub(0.5).abs()
    const sapBand = sapDistance.smoothstep(0.03, 0.16).oneMinus().mul(mx_fractal_noise_float(p.mul(2.4).add(5.7), 2, 2.1, 0.5).mul(0.3).add(0.7))
    const woodColor = mix(mix(amber, sapwood, heartBlend.mul(0.42)).mul(earlywood.mul(0.08).add(0.94)).mul(late.mul(0.32).oneMinus()), color(hsl.integer(76, 47, 76)), sapBand.mul(0.34))
// Pores and rays are a different order of magnitude: elongated openings along the grain and radial flecks across it.
    const poreField = mx_noise_float(tubeTorus(tube, 0.2, 2.6).mul(30).add(vec3(0, 0, 7.3))).mul(0.5).add(0.5)
    const pore = poreField.smoothstep(0.64, 0.71).mul(intimate.mul(0.92).add(0.08))
    const poreFootprint = vec2(tube.x.mul(66), tube.y.mul(340)).fwidth().length()
    const poreResolve = poreFootprint.smoothstep(0.28, 0.9).oneMinus()
    const poreLine = mx_noise_float(tubeTorus(tube, 0.3, 4.2).mul(45).add(vec3(0, 0, -3.4))).mul(0.5).add(0.5).smoothstep(0.6, 0.68)
    const rayPhase = tube.x.mul(TAU * 93).add(figure.mul(2.3))
    const ray = rayPhase.sin().abs().pow(15).mul(rayPhase.fwidth().smoothstep(0.25, 0.8).oneMinus()).mul(intimate).mul(0.6)
// A few hairline drying checks follow the grain and catch a dark line of shadow.
    const checkPhase = tube.y.mul(TAU * 37).add(figure.mul(1.2)).add(mx_noise_float(p.mul(12)).mul(0.8))
    const check = checkPhase.sin().abs().smoothstep(0.02, 0.055).oneMinus().mul(checkPhase.fwidth().max(0.001).smoothstep(0.05, 0.2).oneMinus())
    const checkMask = mx_fractal_noise_float(p.mul(1.6).add(30.7), 2, 2.1, 0.5).smoothstep(0.32, 0.52).mul(0.65)
    const checks = check.mul(checkMask).mul(intimate)
    const poreDark = pore.mul(poreResolve).mul(0.7).add(poreLine.mul(poreResolve).mul(0.25)).add(ray.mul(0.15)).add(checks.mul(0.8)).clamp()
    this.colorNode = woodColor.mul(float(1).sub(poreDark.mul(0.62))).mul(ringTransition.mul(resolved).mul(0.07).add(0.93))
    this.metalnessNode = float(0.02)
    this.roughnessNode = float(0.36).sub(poreDark.mul(0.08)).add(ringTransition.mul(0.03)).clamp(0.2, 0.58)
    this.anisotropy = 0.7
    this.anisotropyRotation = 0
    this.sheen = 0.26
    this.sheenColor.set(hsl.integer(75, 69, 77))
    this.sheenRoughness = 0.36
    this.clearcoat = 0.24
    this.clearcoatRoughness = 0.16
    this.normalNode = detailNormal(baseNormal, late.mul(resolved).mul(0.00055).add(poreDark.mul(0.00038)).add(burl.mul(0.0004)), 1.05)
    this.aoNode = float(1).sub(poreDark.mul(0.3))
    const oil = environmentHighlight(environment, n, 0.18)
    const fire = oil.mul(woodColor).mul(mix(float(0.08), float(0.34), mottle)).mul(near.mul(0.65).add(0.4))
    const sheen = studioSheen(n).mul(color(hsl.integer(74, 72, 80))).mul(near.mul(0.06).add(0.07))
    const rim = color(hsl.integer(61, 75, 59)).mul(grazing.pow(3)).mul(0.055)
    this.emissiveNode = fire.add(sheen).add(rim)
  }
}
