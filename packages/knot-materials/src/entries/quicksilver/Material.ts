import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {fieldMask} from '../../candidates/deepseek/lib/fieldMask.ts'
import {uvFootprint} from '../../candidates/deepseek/lib/uvFootprint.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const beadsAcross = 30
const beadsAround = 8
/** Mercury pretending to be a knot. The surface never settles: a slow tide rolls through the metal, hundreds of beads ride it, and the whole mass shivers along its length. Gravity pulls the drops underneath into hanging eggs while the ones on top stay round, the way real quicksilver bruises a little where it rests. Patches of dull tarnish drift across it with the same tide – until you come close, where the film turns out to be crystalline and the mirror below it is flawless. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const p = viewerFrame().p
    const {grazing, near, intimate} = viewerFrame()
    const t = time
    const tube = uv()
    const beadFootprint = uvFootprint()
// Two slow tides: one rolls through the metal, one shivers along its length.
    const tide = p.mul(2.6).add(vec3(t.mul(0.03), t.mul(-0.022), t.mul(0.026)))
    const lift = mx_noise_float(tide).mul(0.006).add(mx_noise_float(p.mul(5.5).add(vec3(0, t.mul(0.05), 0))).mul(0.002))
    const shiver = tube.x.mul(Math.PI * 6).sub(t.mul(Math.PI)).sin().mul(0.003)
    this.positionNode = positionGeometry.add(normalLocal.mul(lift.mul(near.mul(0.4).add(0.6)).add(shiver)))
// Beads ride an advected lattice, so the drops drift and merge instead of sitting still.
    const tidePhase = t.mul(Math.PI)
    const flow = vec2(mx_noise_float(p.mul(2.2).add(vec3(0, tidePhase.mul(0.35), 0))), mx_noise_float(p.mul(2.2).add(vec3(5.3, tidePhase.mul(-0.28), 1.7)))).add(vec2(tidePhase.sin(), tidePhase.mul(2).cos()).mul(0.5))
    const beadSpace = vec2(tube.x.mul(beadsAcross), tube.y.mul(beadsAround)).add(flow.mul(0.8).mul(vec2(1, 0.5)))
    const beadCell = beadSpace.floor()
    const beadLocal = beadSpace.fract().sub(0.5)
    const identity = cellNoiseVec3(vec3(beadCell.x.mod(beadsAcross).add(beadsAcross).mod(beadsAcross), beadCell.y.mod(beadsAround).add(beadsAround).mod(beadsAround), 2.3))
    const radius = identity.x.mul(0.16).add(0.17)
    const offset = identity.yz.sub(0.5).mul(0.3)
    const inBead = beadLocal.sub(vec2(offset.x, offset.y))
    const hanging = normalLocal.y.negate().clamp()
    const stretch = vec2(1, float(1).add(hanging.mul(0.55)))
    const beadDistance = inBead.mul(stretch).length().div(radius)
    const bead = beadDistance.mul(beadDistance).oneMinus().max(0).sqrt()
    const beadResolved = float(0.4).div(beadFootprint.v.mul(beadsAround).max(beadFootprint.u.mul(beadsAcross))).min(1)
// Tarnish drifts in patches and only reveals its crystalline grain up close.
    const tarnishField = mx_fractal_noise_float(p.mul(4.2).add(vec3(t.mul(0.012), t.mul(0.008), t.mul(-0.01))), 3, 2, 0.5)
    const tarnish = fieldMask(tarnishField, float(0.14), 0.5)
    const film = mx_noise_float(p.mul(120).add(vec3(0, t.mul(0.02), 0))).mul(0.5).add(0.5)
    const metal = mix(color(hsl.integer(251, 11, 41)), color(hsl.integer(248, 44, 94)), bead.pow(0.55).mul(0.85).add(0.15))
    const oxide = mix(color(hsl.integer(248, 13, 35)), color(hsl.integer(251, 12, 56)), film.mul(0.5).add(0.3))
    this.colorNode = mix(metal, oxide, tarnish.coverage.mul(0.85))
    const crease = bead.mul(bead.oneMinus()).mul(4).mul(-1)
    const relief = bead.mul(beadResolved).add(crease.mul(0.25)).add(tarnish.coverage.mul(near).mul(film.mul(0.2).add(0.1)))
    this.normalNode = proceduralNormal(relief, float(0.018).mul(beadResolved.mul(0.8).add(0.2)))
    this.metalnessNode = float(0.98).sub(tarnish.coverage.mul(0.5))
    this.roughnessNode = mix(float(0.035), float(0.42), tarnish.coverage).add(film.mul(0.02).mul(near)).add(grazing.mul(0.01))
    this.specularColorNode = mix(color(hsl.integer(0, 0, 100)), color(hsl.integer(246, 43, 88)), tarnish.coverage)
    this.anisotropy = 0.2
    this.clearcoat = 0.25
    this.clearcoatRoughness = 0.05
    this.emissiveNode = color(hsl.integer(241, 55, 84.5)).mul(grazing.pow(4)).mul(0.06)
      .add(color(hsl.integer(243, 53, 78)).mul(intimate).mul(0.03))
  }
}
