import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, mix, mx_fractal_noise_float, mx_noise_float, normalView, normalWorld, positionGeometry, positionWorld, reflect, refract, time, vec3} from 'three/tsl'

import {airBubbles} from '../../candidates/space_bunny/lib/airBubbles.ts'
import {backlight} from '../../candidates/space_bunny/lib/backlight.ts'
import {studioRadiance} from '../../candidates/space_bunny/lib/studio.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** The chord a ray cuts through a convex resin body, in absorption units. Long in the middle, short at the silhouette. */
const resinChord = (facing: Node<'float'>, diameter: number) => facing.mul(diameter).add(0.05)
/** Turbulence sampled at a real depth inside the resin, so the cloud parallaxes as you walk around the stone. */
function resinCloud(view: Node<'vec3'>, depth: number, scale: number, stretch: number) {
  const sample = positionGeometry.sub(view.mul(depth))
  return {
    veil: mx_fractal_noise_float(sample.mul(scale), 3, 2.12, 0.55).mul(0.5).add(0.5),
    sheet: sample.mul(vec3(scale, scale, scale * stretch)),
  }
}
/** One colour channel bending into the stone. Total internal reflection kills the ray, so mirror instead. */
function refractedRay(ior: number) {
  const incident = positionWorld.sub(cameraPosition).normalize()
  const bent = refract(incident, normalWorld, float(1).div(ior))
  const alive = bent.dot(bent).greaterThan(0.25).select(float(1), float(0))
  return {
    alive,
    ray: mix(reflect(incident, normalWorld), bent, alive),
  }
}

/** A ten-million-year vigil cast in amber. Every photon that reaches your eye crossed the whole body of the resin and was eaten on the way, so the stone runs from pale gold at the grazing silhouette - where the chord is short - to a burning cognac where you look straight through two hundred millimetres of tree. What lights it is the studio bent through the body and split by the 1.55 index into a faint chromatic fringe, and the flow striae and trapped air slide against the surface as you walk, because they really are a centimetre below it. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.34)
    this.name = knotData.id
    const {p, view, facing, grazing, near} = viewerFrame()
// Blue is swallowed by the resin; red survives the longest chord, which is why thin edges stay gold.
    const absorption = vec3(0.12, 0.52, 2)
    const body = absorption.mul(resinChord(facing, 2.4)).negate().exp()
    const cloud = resinCloud(view, 0.055, 3.2, 3.1)
    const veil = resinCloud(view, 0.105, 1.5, 1.4)
    const milk = cloud.veil.mul(0.66).add(veil.veil.mul(0.34)).smoothstep(0.5, 0.95)
// Air trapped at two depths: a near swarm and a slow drift of larger pockets deeper in the resin.
    const nearAir = airBubbles(positionGeometry.sub(view.mul(0.038)), 46, 7.3)
    const deepAir = airBubbles(positionGeometry.sub(view.mul(0.12)), 17, 2.1)
    const bubbles = nearAir.body.mul(0.8).add(deepAir.body).clamp()
    const bubbleRing = nearAir.rim.mul(0.7).add(deepAir.rim.mul(1.1))
    const bubbleGlint = nearAir.crown.mul(0.9).add(deepAir.crown.mul(1.2))
// A century of polishing cloth leaves a fine directional haze.
    const scratches = mx_noise_float(p.mul(vec3(38, 7, 31)).add(cloud.veil.mul(2.4))).abs().pow(0.32).oneMinus().mul(near)
// Chromatic dispersion: red bends least, blue most, so a soft fringe rides every bent edge.
    const red = refractedRay(1.541)
    const green = refractedRay(1.55)
    const blue = refractedRay(1.568)
    const spectrum = vec3(studioRadiance(red.ray).r, studioRadiance(green.ray).g, studioRadiance(blue.ray).b)
// Light that entered from behind and left toward you, reddened by the resin and clouded by the breath.
    const breath = time.mul(0.38).add(p.x.mul(1.1)).add(p.z.mul(0.7)).sin().mul(0.5).add(0.5)
    const through = backlight(normalView, 5, 0.32).mul(breath.mul(0.16).add(0.92))
    const cloudGlow = mix(float(0.8), float(1.12), milk)
    this.colorNode = color(hsl.integer(49, 79, 9)).mul(float(1).add(milk.mul(0.5)))
    this.metalness = 0
    this.roughnessNode = float(0.03).add(scratches.mul(0.24)).clamp(0.01, 0.4)
    this.ior = 1.55
    this.clearcoat = 0.42
    this.clearcoatRoughnessNode = float(0.015).add(scratches.mul(0.08))
    this.emissiveNode = spectrum.mul(body).mul(cloudGlow).mul(4.2)
      .add(color(hsl.integer(50, 100, 68)).mul(through).mul(body).mul(1.6))
      .add(color(hsl.integer(74, 100, 89)).mul(bubbleRing).mul(0.09))
      .add(color(hsl.integer(82, 100, 95.4)).mul(bubbleGlint).mul(0.05))
      .add(color(hsl.integer(51, 73, 11)).mul(bubbles).mul(facing.mul(0.7).add(0.2)))
      .add(color(hsl.integer(78, 100, 89)).mul(scratches).mul(grazing.pow(2.4)).mul(0.22))
  }
}
