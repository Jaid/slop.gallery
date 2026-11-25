import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, float, Fn, mix, modelWorldMatrixInverse, mx_fractal_noise_float, mx_noise_float, time, transformNormalToView, uv, varying, vec2, vec3, vec4} from 'three/tsl'

import {cellNoiseVec3} from '../../candidates/claude_fable/lib/cellNoiseVec3.ts'
import {debugLayer} from '../../candidates/claude_fable/lib/debugLayer.ts'
import {environmentHighlight} from '../../candidates/claude_fable/lib/environmentHighlight.ts'
import {fresnel} from '../../candidates/claude_fable/lib/interiorRay.ts'
import {knotFrame} from '../../candidates/claude_fable/lib/knotFrame.ts'
import {proceduralNormal} from '../../candidates/claude_fable/lib/proceduralNormal.ts'
import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {tubeLattice} from '../../candidates/claude_fable/lib/tubeCoordinates.ts'
import {viewerFrame} from '../../candidates/claude_fable/lib/viewerFrame.ts'
import {wrapCell} from '../../candidates/claude_fable/lib/wrapCell.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import knotData from './data.ts'

/** Slow peristaltic breathing plus a nervous shiver near the viewer, in the vertex stage. */
const breathing = (tube: Node<'vec2'>, p: Node<'vec3'>) => {
  const t = time
  const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
  const proximity = cameraLocal.sub(p).length().smoothstep(0.6, 3).oneMinus()
  const wave = tube.x.mul(Math.PI * 2 * 5).sub(t.mul(1.1)).sin()
  const breath = wave.mul(0.5).add(0.5).pow(2).mul(0.012)
  const shiver = p.dot(vec3(31, 27, -29)).add(t.mul(9)).sin().mul(proximity).mul(0.0025)
  const pulse = t.mul(0.6).fract().mul(-6).exp().mul(tube.x.mul(Math.PI * 2 * 2).sin().mul(0.5).add(0.5)).mul(0.005)
  return breath.add(shiver).add(pulse)
}
const bodySurface = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  return p.add(normal.mul(breathing(tube, p)))
})
/** A deep-sea creature. Its skin is a dark, wet, translucent gel with a scatter of photophores – light organs arranged in a lattice – that fire in rings running away from the point nearest to the viewer, so the animal visibly reacts to being approached. Chromatophores under the skin bloom from violet to crimson as the viewer comes close; the whole body breathes with a peristaltic wave and shivers at close range. At the limb, the gel glows with subsurface cyan. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const tube = uv()
    const {p, cameraLocal, facing, grazing, near, intimate} = viewerFrame()
    this.positionNode = bodySurface(tube)
    const epsilon = 0.0004
    const du = bodySurface(tube.add(vec2(epsilon, 0))).sub(bodySurface(tube.sub(vec2(epsilon, 0))))
    const dv = bodySurface(tube.add(vec2(0, epsilon))).sub(bodySurface(tube.sub(vec2(0, epsilon))))
    const displacedNormal = vec3(varying(transformNormalToView(du.cross(dv).normalize()))).normalize()
    const t = time
// Where the viewer is: the surface point nearest the camera is the origin of every response.
    const viewerDistance = cameraLocal.sub(p).length()
    const objectDistance = cameraLocal.length()
    const nearestDistance = objectDistance.sub(0.62).max(0.05)
    const reach = viewerDistance.sub(nearestDistance)
    const proximity = objectDistance.smoothstep(1.2, 4).oneMinus()
// Rings run away from the viewer; their speed and count grow as the viewer approaches. A slow idle ripple stays on.
    const rings = reach.mul(9).sub(t.mul(2.6)).sin().mul(0.5).add(0.5).pow(3).mul(reach.mul(-0.5).exp())
    const idleWave = tube.x.mul(Math.PI * 2 * 3).sub(t.mul(0.7)).sin().mul(0.5).add(0.5).pow(4).mul(0.5)
// Evaluate every nearby organ independently: nearest-site ownership cuts larger circles off at Voronoi borders.
    const {lattice, period} = tubeLattice(9)
    const base = lattice.floor()
    const local = lattice.fract()
    const footprint = lattice.fwidth().length().max(0.001)
    const resolved = footprint.smoothstep(0.3, 1).oneMinus()
    let photophores: Node<'vec3'> = vec3(0)
    let organDisc: Node<'float'> = float(0)
    let goosebumps: Node<'float'> = float(0)
    let firing: Node<'float'> = float(0)
    for (let i = -1;i <= 1;i++) {
      for (let j = -1;j <= 1;j++) {
        const offset = vec2(i, j)
        const cell = wrapCell(base.add(offset), period)
        const feature = offset.add(cellNoiseVec3(vec3(cell, 4)).xy)
        const distance = feature.sub(local).length()
        const organ = cellNoiseVec3(vec3(cell, 3))
        const radius = organ.x.mul(0.14).add(0.16)
        // Bounded support keeps the 3×3 search complete, including across both UV wraps.
        const disc = distance.smoothstep(radius.sub(footprint).max(0), radius.add(footprint).min(0.45)).oneMinus().mul(resolved)
        const dome = distance.div(radius).clamp().pow2().oneMinus().max(0).sqrt()
        const gate = organ.y.smoothstep(0.25, 0.35)
        const idle = idleWave.add(organ.y.mul(0.15))
        const flicker = t.mul(organ.z.mul(3).add(2)).add(organ.z.mul(40)).sin().mul(0.15).add(0.85)
        const organFiring = rings.mul(proximity.mul(1.4).add(0.3)).add(idle).mul(flicker).clamp()
        const organColor = mix(rgb(hsl.integer(204, 99, 85)), rgb(hsl.integer(166, 100, 91.9)), organ.z)
        const halo = distance.div(radius).mul(-2.2).exp().mul(0.5)
          .mul(distance.smoothstep(0.6, 0.9).oneMinus()).mul(resolved)
        photophores = photophores.add(organColor.mul(disc.mul(dome.mul(0.6).add(0.4)).add(halo)).mul(gate).mul(organFiring))
        firing = firing.max(organFiring.mul(disc).mul(gate))
        organDisc = organDisc.max(disc.mul(gate))
        goosebumps = goosebumps.max(dome.mul(disc).mul(gate).mul(0.0025))
      }
    }
// Chromatophores: pigment cells that expand as the viewer comes close, turning the skin from violet to crimson.
    const cells = mx_fractal_noise_float(p.mul(14).add(vec3(0, t.mul(0.05), 0)), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const expansion = proximity.mul(0.5).add(0.2).add(t.mul(0.9).sin().mul(0.05))
    const chromatophore = cells.smoothstep(expansion.oneMinus().mul(0.7), expansion.oneMinus().mul(0.7).add(0.25))
    const skinColor = mix(rgb(hsl.integer(297, 65, 9)), mix(rgb(hsl.integer(317, 77, 27)), rgb(hsl.integer(16, 92, 47)), proximity), chromatophore)
// Wet gel: slippery highlights, a translucent limb, and fine surface texture from the organs and skin cells.
    const skinGrain = mx_noise_float(p.mul(90)).mul(0.0003)
    const surfaceNormal = proceduralNormal(goosebumps.add(skinGrain).add(chromatophore.mul(0.0004)), 1, displacedNormal)
    this.normalNode = surfaceNormal
    this.colorNode = skinColor
    this.metalness = 0
    this.roughnessNode = float(0.18).add(chromatophore.mul(0.12)).sub(organDisc.mul(0.08))
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.08
    this.clearcoatNormalNode = displacedNormal
    this.sheen = 0.5
    this.sheenColor.set(hsl.integer(265.5, 100, 52))
    this.sheenRoughness = 0.5
// Light: subsurface cyan at the limb, the organs, a warm rush of blood in the skin up close, and wet reflections.
    const subsurface = rgb(hsl.integer(232, 86, 49)).mul(grazing.pow(2.5)).mul(fresnel(facing, 0.02).oneMinus()).mul(0.35)
    const blush = rgb(hsl.integer(18, 99, 60)).mul(chromatophore).mul(intimate).mul(t.mul(1.4).sin().mul(0.2).add(0.8)).mul(0.12)
    const wet = environmentHighlight(environment, vec3(du.cross(dv).normalize()), 0.05).mul(fresnel(facing, 0.03)).mul(0.6)
    const {emissive, isolated} = debugLayer({
      photophores,
      rings,
      firing,
      chromatophore,
      subsurface,
      blush,
      wet,
      organDisc,
    }, () => photophores.mul(near.mul(0.3).add(1)).mul(3).add(subsurface).add(blush).add(wet))
    this.emissiveNode = emissive
    if (isolated) {
      this.colorNode = vec3(0)
      this.envMapIntensity = 0
      this.clearcoat = 0
      this.sheen = 0
    }
  }
}
