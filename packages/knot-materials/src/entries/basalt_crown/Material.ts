import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec3, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {loopPhase} from '../../candidates/space_bunny/lib/loopClock.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {displacementView} from '../../lib/displacementView.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A lava crust caught mid-argument with itself. The surface has already set into polygonal plates, each one bulged and roped by the flow that pushed it there, but the rock underneath never finished cooling, so the seams between the plates are still open furnace. Heat runs along those seams in slow waves and sparks climb out of them on a schedule that closes the two-second loop exactly: half a lattice cell per second, three harmonics per loop, no jump on repeat. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, view, grazing} = viewerFrame()
    const {near} = displacementView()
// The plates: Worley cells, each with its own tone, its own thickness and its own slow drift.
    const plateSize = 8.5
    const cells = mx_fractal_noise_float(p.mul(plateSize), 3, 2.05, 0.5).mul(0.5).add(0.5)
    const wall = cellularBoundary(p.sub(view.mul(0.05)).mul(plateSize))
    const seam = wall.smoothstep(0.004, 0.062).oneMinus()
    const core = wall.smoothstep(0, 0.02).oneMinus()
    const plateId = p.mul(plateSize).floor()
    const identity = cellNoiseVec3(plateId)
    const lift = identity.x.mul(0.5).add(0.5)
// Pahoehoe rope: the crust is dragged into folds as it stiffens, so every plate has a grain.
    const flow = vec3(0.62, 0.28, -0.73).normalize()
    const ropePhase = p.dot(flow).mul(96).add(mx_noise_float(p.mul(3.4)).mul(9)).add(identity.y.mul(6))
    const rope = ropePhase.sin().mul(0.5).add(0.5).pow(2.2).mul(seam.oneMinus()).mul(near.mul(0.6).add(0.4))
// Hairline crazing inside each plate: the crust is glassy and it is still contracting.
    const craze = filament(mx_noise_float(p.mul(26).add(identity.mul(4.1))), 0.007).mul(seam.oneMinus()).mul(near)
// Vesicles: gas bubbles frozen into the crust, and the small pits the plates shrink around.
    const pits = mx_worley_noise_vec3(p.mul(64), 1, 0).x
    const vesicle = pits.smoothstep(0.02, 0.1).oneMinus().mul(near)
// Heat: a wave travelling along the seams, breathing on a harmonic that closes the loop.
    const travel = loopPhase.mul(3).add(p.dot(vec3(3.1, -1.7, 2.4)).mul(1.6)).add(identity.z.mul(6.28))
    const wave = travel.sin().mul(0.5).add(0.5).pow(1.6)
    const breath = loopPhase.mul(2).sin().mul(0.22).add(0.86)
    const heat = seam.mul(breath).mul(wave.mul(0.62).add(0.38))
    const molten = mix(color(hsl.integer(33, 98, 33.5)), color(hsl.integer(49.4, 100, 67.8)), heat.pow(1.4))
    const white = mix(color(hsl.integer(56, 100, 70.9)), color(hsl.integer(88, 100, 92.4)), core.mul(heat).pow(1.6))
// Sparks ride the convection: half a lattice cell per second, so two seconds is one whole cell.
    const sparkField = cellularPoints(p.mul(46).add(vec3(0, time.mul(23), 0)), 0.02, 0.11, 0.74)
    const spark = sparkField.mul(seam.mul(0.6).add(0.4)).mul(near.mul(0.4).add(0.6))
    const soot = mx_fractal_noise_float(p.mul(2.2).add(vec3(9.1, -4.3, 1.7)), 4, 2.1, 0.55).mul(0.5).add(0.5)
    const basalt = mix(color(hsl.integer(39, 9, 7)), color(hsl.integer(34, 10, 23)), cells.mul(0.55).add(soot.mul(0.45)))
    const scoria = mix(basalt, color(hsl.integer(302, 14, 5)), vesicle.mul(0.55))
// The furnace lights its own lid from below.
    this.colorNode = mix(mix(scoria, color(hsl.integer(298, 19, 4)), craze.mul(0.5)), molten.mul(0.6), seam.mul(0.55)).add(molten.mul(heat.mul(0.6)))
    this.metalness = 0
    this.roughnessNode = float(0.82).sub(lift.mul(0.18)).sub(rope.mul(0.16)).add(vesicle.mul(0.08)).clamp(0.12, 1)
    this.ior = 1.48
    this.clearcoatNode = seam.mul(0.35).add(lift.mul(0.12))
    this.clearcoatRoughnessNode = float(0.22).sub(lift.mul(0.1)).clamp(0.06, 0.5)
// Vertex displacement may not touch derivatives, so the fine crazing only lives in the bump.
    const relief = lift.mul(0.5).mul(seam.oneMinus()).sub(seam.mul(0.9)).add(rope.mul(0.3)).sub(vesicle.mul(0.5))
    const surface = relief.sub(craze.mul(0.25))
    this.positionNode = positionGeometry.add(normalLocal.mul(relief.mul(0.012)))
    this.normalNode = proceduralNormal(surface, 0.012)
    this.emissiveNode = molten.mul(heat.mul(2.6))
      .add(white.mul(core.mul(heat).mul(4.2)))
      .add(color(hsl.integer(47, 100, 68)).mul(seam.mul(heat).mul(grazing.mul(0.8).add(0.35)).mul(1.1)))
      .add(color(hsl.integer(92, 100, 94.7)).mul(spark.mul(3.6)))
      .add(color(hsl.integer(38, 76, 10)).mul(grazing.mul(heat).mul(0.35)))
  }
}
