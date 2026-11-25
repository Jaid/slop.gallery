import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, transformNormalToView, vec3} from 'three/tsl'

import {lampFlash} from '../../candidates/space_bunny/lib/lampFlash.ts'
import {loopPhase} from '../../candidates/space_bunny/lib/loopClock.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {displacementView} from '../../lib/displacementView.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** One spike of the Rosensweig field: its axis leans at the viewer and its radius tapers to a point. */
function spike(point: Node<'vec3'>, size: number, lean: Node<'vec3'>, swell: Node<'float'>, face: Node<'vec3'>, tilt: number) {
  const cell = point.div(size).floor()
  const identity = cellNoiseVec3(cell)
  const centre = identity.mul(0.5).add(0.25)
  const local = point.div(size).fract().sub(centre)
  const distance = local.length()
  const radius = float(size * 0.4).mul(identity.x.mul(0.45).add(0.7))
  const height = float(size * 0.85).mul(identity.y.mul(0.5).add(0.72)).mul(swell).mul(identity.z.smoothstep(0.34, 0.46))
  const axis = mix(face, lean, tilt).normalize()
  const profile = distance.smoothstep(radius, radius.mul(0.08))
  const cone = local.div(distance.max(0.0002)).mul(radius).add(axis.mul(height)).normalize()
  return {
    axis,
    cone,
    height,
    profile,
    radius,
  }
}
/** A tide of iron. The surface is a black mirror that has lost its surface tension: every few centimetres it stands up into a cone, because a magnet this close is not a metaphor. The cones lean toward whichever eye is nearest and grow as that eye comes in, which is why the silhouette is never the same shape twice from the same spot. Between them the pool keeps a skin of oil thin enough to throw rainbows, and a slower tide underneath keeps the whole thing breathing. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.5)
    this.name = knotData.id
    const {p, cameraLocal, grazing} = viewerFrame()
    const {near, intimate} = displacementView()
// The tide under the skin: two harmonics that close on the loop, so the pool never jumps.
    const swell = loopPhase.sin().mul(p.dot(vec3(2.1, -1.4, 1.7))).add(loopPhase.mul(2).sin().mul(p.dot(vec3(-3.4, 2.6, 1.2))).mul(0.45)).mul(0.004)
    const swellNormal = loopPhase.cos().mul(vec3(2.1, -1.4, 1.7)).add(loopPhase.mul(2).cos().mul(vec3(-3.4, 2.6, 1.2)).mul(0.9)).mul(0.004)
// The field is uniform: every cone leans along the line to the visitor, none of them inward.
    const lean = cameraLocal.normalize()
    const pulse = loopPhase.mul(2).sin().mul(0.14).add(0.9)
    const coarse = spike(p, 0.062, lean, intimate.mul(0.85).add(0.3).mul(pulse), normalLocal, 0.72)
    const fine = spike(p, 0.0195, lean, near.mul(0.8).add(0.35).mul(pulse), normalLocal, 0.44)
// Vertex displacement may not touch derivatives: both spike fields are pure algebra.
    this.positionNode = positionGeometry.add(normalLocal.mul(swell)).add(coarse.axis.mul(coarse.profile.mul(coarse.height))).add(fine.axis.mul(fine.profile.mul(fine.height).mul(near.mul(0.8).add(0.2))))
    const pool = transformNormalToView(normalLocal.add(swellNormal)).normalize()
    const coarseCone = transformNormalToView(coarse.cone).normalize()
    const fineCone = transformNormalToView(fine.cone).normalize()
    const standing = mix(pool, coarseCone, coarse.profile)
    const spiked = mix(standing, fineCone, fine.profile.mul(near.mul(0.8).add(0.2)).mul(0.7))
    const film = mx_noise_float(p.mul(4.6).add(vec3(1.7, -3.3, 5.2))).mul(0.5).add(0.5)
    const skin = film.mul(0.7).add(mx_noise_float(p.mul(13)).mul(0.5).add(0.5).mul(0.3))
    this.colorNode = mix(color(hsl.integer(268, 18, 6)), color(hsl.integer(264, 24, 12)), film)
    this.metalness = 1
    this.roughnessNode = float(0.035).add(film.mul(0.05)).add(fine.profile.mul(0.06)).add(coarse.profile.mul(0.04)).clamp(0.02, 0.4)
    this.iridescence = 0.75
    this.iridescenceIOR = 1.32
    this.iridescenceThicknessNode = skin.mul(620).add(180)
    this.normalNode = spiked
    const edge = lampFlash(coarseCone, 90).add(lampFlash(fineCone, 160).mul(near))
    this.emissiveNode = color(hsl.integer(250, 100, 90)).mul(edge.mul(0.35))
      .add(color(hsl.integer(230, 100, 81)).mul(grazing.pow(4)).mul(0.05))
  }
}
