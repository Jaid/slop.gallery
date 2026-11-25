import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, If, Loop, mix, mx_noise_float, time, uv, varying, vec3} from 'three/tsl'

import {knotCurve, knotLength} from '../../candidates/claude_haiku/lib/knotCurve.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const coarseSamples = 64
const fineSamples = 16
/** Parameter of the centerline point nearest the viewer, found by a coarse scan refined inside its best cell. Uniform across the mesh, so it is computed per vertex and interpolated. */
const nearestAlongKnot = (cameraLocal: Node<'vec3'>) => Fn(() => {
  const bestU = float(0).toVar()
  const bestDistance = float(1e9).toVar()
  Loop({
    start: 0,
    end: coarseSamples,
    type: 'int',
  }, ({i}) => {
    const candidate = float(i).add(0.5).div(coarseSamples)
    const distance = knotCurve(candidate.mul(Math.PI * 4)).sub(cameraLocal).lengthSq()
    If(distance.lessThan(bestDistance), () => {
      bestDistance.assign(distance)
      bestU.assign(candidate)
    })
  })
  const center = bestU.toVar()
// Fine samples tile exactly one coarse cell, centered on the coarse winner.
  const step = 1 / coarseSamples / fineSamples
  Loop({
    start: 0,
    end: fineSamples,
    type: 'int',
  }, ({i}) => {
    const candidate = center.add(float(i).add(0.5).sub(fineSamples / 2).mul(step))
    const distance = knotCurve(candidate.mul(Math.PI * 4)).sub(cameraLocal).lengthSq()
    If(distance.lessThan(bestDistance), () => {
      bestDistance.assign(distance)
      bestU.assign(candidate)
    })
  })
  return bestU
})()
/** Dormant bioluminescent plankton: a wake of cold green light runs along the knot from the point nearest you, while sparks gather in the dark. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, cameraLocal, near} = viewerFrame()
    const tube = uv()
    const nearest = varying(nearestAlongKnot(cameraLocal))
// Signed periodic distance along the knot, converted to physical units.
    const offset = tube.x.sub(nearest).add(0.5).fract().sub(0.5)
    const along = offset.abs().mul(knotLength)
    const period = 2.4
    const clock = time.div(period)
    const front = (phase: Node<'float'>) => {
      const radius = phase.mul(knotLength * 0.55)
      return along.sub(radius).div(0.22).pow2().negate().exp().mul(phase.oneMinus().pow(1.5))
    }
    const pulse = front(clock.fract()).add(front(clock.add(0.5).fract()).mul(0.7))
    const plankton = cellularPoints(p.mul(34), 0.1)
    const shimmer = mx_noise_float(p.mul(3.1).add(vec3(0, 0, time.mul(0.1)))).mul(0.5).add(0.5)
    const glow = mix(color(hsl.integer(179, 94.6, 85)), color(hsl.integer(260, 100, 55)), shimmer)
    const intensity = near.mul(0.9).add(0.25)
    this.colorNode = color(hsl.integer(233, 47, 4))
    this.metalness = 0
    this.roughness = 0.12
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.emissiveNode = glow.mul(plankton.mul(pulse).mul(3).add(pulse.mul(0.35)).add(plankton.mul(0.03))).mul(intensity)
  }
}
