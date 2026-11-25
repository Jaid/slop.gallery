import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentView, color, float, mix, mx_fractal_noise_float, negateOnBackSide, normalLocal, positionGeometry, tangentView, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A coil wound onto the knot itself. The wire is a real helix in the tube's parameter space: its metric distance to the winding axis sets the cylindrical profile and the true surface normal of the round copper, so the highlights run along the winding instead of across it. Current crawls through the turns and the gaps between them flash. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
// Metric of the knot's own UV: about 4.5 units along the tube, 0.82 around it.
    const alongMetric = 4.5
    const aroundMetric = 0.817
    const turns = 62
    const gradU = turns / alongMetric
    const gradV = -1 / aroundMetric
    const gradient = Math.hypot(gradU, gradV)
    const phase = tube.x.mul(turns).sub(tube.y)
    const signed = phase.fract().sub(0.5)
    const spacing = 1 / gradient
    const wireRadius = spacing * 0.4
    const s = signed.div(gradient).div(wireRadius)
    const inside = s.abs().oneMinus().max(0)
    const profile = inside.sqrt()
    const surface = normalLocal.normalize()
    const tangent = tangentView.normalize()
    const bitangent = vec3(bitangentView as unknown as ReturnType<typeof vec3>).normalize()
// Across-wire direction, in view space, from the UV metric gradient.
    const across = tangent.mul(gradU).sub(bitangent.mul(gradV)).normalize()
    const wireNormal = surface.mul(profile).add(across.mul(s.clamp(-1, 1))).normalize()
    const coreNormal = surface
    this.normalNode = negateOnBackSide(transformNormalToView(mix(coreNormal, wireNormal, inside.smoothstep(0, 0.02))))
    this.clearcoatNormalNode = this.normalNode
// ------------------------------------------------------------------
// Copper, aged unevenly, with the patina pooling in the gaps.
// ------------------------------------------------------------------
    const grain = mx_fractal_noise_float(p.mul(46), 3, 2.2, 0.5).mul(0.5).add(0.5)
    // Continuous oxidation avoids stamping grid-cell faces onto the copper.
    const oxidation = mx_fractal_noise_float(p.mul(30), 3, 2, 0.5).mul(0.5).add(0.5)
    const patinaMask = oxidation.smoothstep(0.55, 0.75).mul(profile.oneMinus().mul(0.65).add(0.35))
    const copper = mix(color(hsl.integer(42, 93, 31)), color(hsl.integer(66, 99, 77)), grain.mul(0.75).add(0.25))
    const patina = mix(color(hsl.integer(175, 63, 28)), color(hsl.integer(168, 67, 53)), grain)
    const core = mix(color(hsl.integer(250, 23, 5)), color(hsl.integer(243, 30, 11)), grain.mul(0.6).add(0.2))
    const wireColor = mix(copper, patina, patinaMask.mul(0.7))
    this.colorNode = mix(core, wireColor, inside.smoothstep(0, 0.03))
    this.metalnessNode = inside.smoothstep(0, 0.03).mul(0.4).add(0.6)
    this.roughnessNode = mix(float(0.55), mix(float(0.22), float(0.07), grain), inside.smoothstep(0, 0.05))
// Anisotropy follows the winding, so the speculars streak around the tube.
// The wire is a real prism on the tube, so the silhouette is a coil and not a pipe.
    this.positionNode = positionGeometry.add(normalLocal.mul(profile.mul(wireRadius).mul(0.3)))
    this.anisotropy = 0.85
    this.anisotropyNode = vec2(0, 1).mul(inside.smoothstep(0, 0.05))
    this.clearcoat = 0.25
    this.clearcoatRoughness = 0.12
// ------------------------------------------------------------------
// Current. A pulse travels the wire and the flux leaks into the gaps,
// brightest where the winding faces you.
// ------------------------------------------------------------------
    const travel = tube.x.mul(turns).sub(time.mul(9))
    const pulse = mx_fractal_noise_float(vec3(travel.mul(0.16), tube.y.mul(4), time.mul(0.2)), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const surge = pulse.smoothstep(0.5, 0.86).pow(1.4)
    const glowField = surge.mul(grazing.pow(0.6).mul(0.7).add(0.3))
    this.emissiveNode = color(hsl.integer(205, 99, 86)).mul(glowField).mul(inside.oneMinus().smoothstep(0, 0.05)).mul(near.mul(0.5).add(0.5)).mul(1.5)
      .add(color(hsl.integer(218, 99, 78.7)).mul(glowField).mul(inside.smoothstep(0.9, 0.99)).mul(0.5))
      .add(color(hsl.integer(78, 100, 89)).mul(inside).mul(facing.pow(8)).mul(0.12))
      .add(color(hsl.integer(220, 83, 29)).mul(glowField).mul(grazing.pow(2)).mul(intimate.mul(0.4).add(0.15)).mul(0.5))
  }
}
