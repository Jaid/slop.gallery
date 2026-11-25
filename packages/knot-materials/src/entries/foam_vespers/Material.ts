import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn as fn, mix, mx_noise_float, mx_worley_noise_float, mx_worley_noise_vec3, normalViewGeometry, positionViewDirection, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

/** Neighboring Voronoi sites keep bubble identities independent of lattice boundaries. */
function foamCells(position: Node<'vec3'>, jitter = 0.62) {
  const distances = mx_worley_noise_vec3(position, jitter, 0)
  const domain = mx_worley_noise_float(position, jitter, 1)
  return {
    first: distances.x,
    identity: cellNoiseVec3(vec3(domain.mul(65_536), 7, 19)),
    // F2 - F1 vanishes on the shared wall between bubbles.
    wall: distances.y.sub(distances.x),
  }
}
const foamScale = 6.5
const reliefAmplitude = 0.015
/** The foam lattice lives in stretched tube space, so the outer surface can be evaluated from a uv pair. */
const toFoamSpace = (coordinate: Node<'vec2'>) => knotFrame(coordinate).position.mul(foamScale)
/** Trim a field’s extremes so shimmering detail never saturates into a flat mask. */
const contrast = (value: Node<'float'>) => value.sub(0.5).abs().mul(2)
/** A froth of soap films growing on the knot. Every bubble carries its own film thickness and its own slow drain, so the interference colours walk down each dome and run to black just before the film rears up again. Where two bubbles meet, the soap gathers into a crease, and the crest of the film carries a rainbow that the eye can follow around the whole knot. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const tube = uv()
/** Dome height of the foam above the tube surface, in object units. */
    const relief = fn(([coordinate]: [Node<'vec2'>]) => {
      const {position, normal} = knotFrame(coordinate)
      const {first, identity, wall} = foamCells(toFoamSpace(coordinate))
      const radius = identity.z.mul(0.14).add(0.44)
      const dome = radius.mul(radius).sub(first.mul(first)).max(0).sqrt().div(radius)
      const breath = time.mul(0.22).add(identity.y.mul(24)).sin().mul(0.16).add(0.94)
      return position.add(normal.mul(dome.mul(wall.smoothstep(0, 0.12)).mul(reliefAmplitude).mul(breath)))
    })
    this.positionNode = relief(tube)
    const epsilon = 0.0004
    const du = relief(tube.add(vec2(epsilon, 0))).sub(relief(tube.sub(vec2(epsilon, 0))))
    const dv = relief(tube.add(vec2(0, epsilon))).sub(relief(tube.sub(vec2(0, epsilon))))
    const reliefNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const foamPosition = toFoamSpace(tube)
    const {first, identity, wall} = foamCells(foamPosition)
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const footprint = foamPosition.fwidth().length()
    const resolved = footprint.smoothstep(0.25, 0.9).oneMinus()
// Plateau borders: where two films meet, the soap gathers into a thick bright crease.
    const crease = wall.mul(foamScale).smoothstep(0.02, footprint.mul(foamScale).add(0.34)).oneMinus()
    const interior = wall.smoothstep(0, footprint.add(0.12))
// Stretched thin over the crown of a dome, and drained of soap, a film goes matte and almost black.
    const crown = mix(float(1), first.div(identity.z.mul(0.14).add(0.44)).min(1), interior)
// A stretched dome is thinnest at its crown and keeps thinning until the film has drained away.
    const drain = time.mul(0.13).add(identity.x.mul(3.7)).fract()
    const thickness = mix(float(0.78), float(0.78).sub(drain.mul(0.62)).mul(crease.mul(0.82).add(0.18)), interior)
// Interference of light that crossed a film of n = 1.33 twice, in nanometres.
    const path = thickness.mul(2.66).mul(facing.pow(0.3)).mul(540)
    const fringe = path.mul(vec3(1 / 680, 1 / 550, 1 / 450)).mul(TAU).cos().mul(0.5).add(0.5)
    const blackFilm = thickness.smoothstep(0.07, 0.24)
// Push the interference colours away from gray: soap films are far more saturated than a cosine.
    const vivid = mix(vec3(fringe.dot(vec3(0.2126, 0.7152, 0.0722))), fringe, 1.75).clamp(0, 1)
    const rainbow = vivid.mul(blackFilm).mul(resolved.mul(0.85).add(0.15))
// Marangoni ripples and the microscopic froth that clings to the walls, both only visible up close.
    const ripple = filament(mx_noise_float(vec3(tube.x.mul(70), tube.y.mul(50), wall.mul(-9))).mul(1.5), 0.07)
    const froth = mx_noise_float(vec3(tube.x.mul(300), tube.y.mul(170), 0)).mul(0.5).add(0.5).smoothstep(0.58, 0.86)
    const sparkle = froth.mul(filament(mx_noise_float(vec3(tube.x.mul(520), tube.y.mul(310), 0)).mul(2), 0.12))
    this.colorNode = mix(color(hsl.integer(243, 18, 4)), color(hsl.integer(241, 26, 9)), blackFilm).mul(crown.pow(2).mul(-0.6).add(1))
      .add(rainbow.mul(0.02))
      .add(color(hsl.integer(237, 23, 91)).mul(crease).mul(0.03))
      .add(rainbow.mul(ripple).mul(0.012))
    this.metalness = 0
    this.roughnessNode = float(0.035).add(contrast(ripple).mul(0.1)).add(froth.mul(0.18)).add(crown.pow(3).mul(0.45)).clamp(0.02, 1)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.03).add(froth.mul(0.05))
    this.ior = 1.33
    this.normalNode = detailNormal(reliefNormal, ripple.mul(0.0007).add(froth.mul(0.0005)), 0.35)
    this.emissiveNode = rainbow.mul(0.1)
      .add(rainbow.mul(ripple).mul(0.06))
      .add(color(hsl.integer(234, 43, 95)).mul(crease).mul(0.03))
      .add(color(hsl.integer(246, 100, 90.7)).mul(sparkle).mul(0.12))
      .add(rainbow.mul(froth).mul(0.08))
  }
}
