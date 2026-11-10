import type {Node, Texture} from 'three/webgpu'

import {bitangentView, cameraPosition, color, float, mix, modelWorldMatrixInverse, mx_noise_float, mx_worley_noise_float, normalViewGeometry, positionViewDirection, tangentView, vec3, vec4} from 'three/tsl'

import {glitter} from '../../candidates/deepseek/lib/glitter.ts'
import {loopOsc, loopWave} from '../../candidates/deepseek/lib/loopClock.ts'
import {spectralHue, visibleWindow} from '../../candidates/deepseek/lib/spectrum.ts'
import {coolStripView, fillPanelView, keyLightView, warmSoftboxView} from '../../candidates/deepseek/lib/studioLights.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const floorBounce = vec3(0.11, -0.74, -0.66).normalize()
/** Every bright source the stone can see: the four studio lights and the bright flooring bounce. */
const fireLamps = [keyLightView, warmSoftboxView, coolStripView, fillPanelView, floorBounce]
/** Bragg reflection of an ordered silica domain. The planes of the lattice are nearly parallel to the surface, so the momentum difference between the viewer and a lamp has to line up with the grating vector: `(V - L) = m λ / d · G`. Its lateral remainder is the mismatch that extinguishes a flash, and its length gives the wavelength the domain diffracts into the eye. Turning the knot therefore walks every patch through the spectrum, exactly like a real black opal. */
const diffraction = (view: Node<'vec3'>, grating: Node<'vec3'>, spacing: Node<'float'>, tolerance: Node<'float'>) => {
  let weight: Node<'float'> = float(0)
  let wavelength: Node<'float'> = float(0)
  for (const lamp of fireLamps) {
    const momentum = view.sub(lamp)
    const along = momentum.dot(grating)
    const lateral = momentum.sub(grating.mul(along)).lengthSq()
    const order = along.abs().mul(spacing)
    const raw = lateral.div(tolerance).negate().exp().mul(visibleWindow(order))
    const gate = raw.mul(raw.mul(0.7).add(0.3))
    weight = weight.add(gate)
    wavelength = wavelength.add(gate.mul(order))
  }
  return {
    fire: spectralHue(wavelength.div(weight.max(0.0001))).mul(weight),
    weight,
  }
}
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, facing, intimate, near} = viewerFrame()
    const view = positionViewDirection
    const surface = normalViewGeometry
    const cameraSide = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const bands = p.length().mul(9).add(mx_noise_float(p.mul(2.2)).mul(2.6))
    const bandTone = bands.sin().mul(0.5).add(0.5)
    const buried = p.sub(cameraSide.mul(0.005))
    const lattice = buried.div(0.026)
    // Crystal identities and their dark boundaries must describe the same Voronoi domains.
    const domainId = mx_worley_noise_float(lattice, 1, 1)
    const latticeRnd = cellNoiseVec3(vec3(domainId.mul(65_536), 7, 19))
    const footprint = lattice.fwidth().length()
    const domainMask = cellularBoundary(lattice).smoothstep(0.025, footprint.add(0.14))
    const twist = latticeRnd.z.mul(TAU)
    const lean = tangentView.mul(twist.cos()).add(vec3(bitangentView as unknown as Node<'vec3'>).mul(twist.sin())).mul(latticeRnd.y.mul(0.5).add(0.06))
    const spacing = latticeRnd.x.mul(130).add(238).add(bandTone.mul(20)).add(loopWave(1).mul(6))
    const patched = diffraction(view, surface.add(lean).normalize(), spacing, float(0.065))
    const smoothRnd = mx_noise_float(p.mul(11)).mul(TAU)
    const smoothLean = tangentView.mul(smoothRnd.cos()).add(vec3(bitangentView as unknown as Node<'vec3'>).mul(smoothRnd.sin())).mul(0.42)
    const smooth = diffraction(view, surface.add(smoothLean).normalize(), float(300).add(bandTone.mul(26)), float(0.3))
    const resolved = footprint.smoothstep(0.45, 1.5).oneMinus()
    const ordered = mx_noise_float(p.mul(6.5).add(13)).mul(0.5).add(0.5)
    const fireMask = ordered.smoothstep(0.18, 0.52).mul(resolved.mul(0.72).add(0.28))
    const fine = mx_noise_float(p.mul(96).add(4)).mul(0.5).add(0.5)
    const fineFlames = mix(float(1), fine.smoothstep(0.36, 0.64).mul(1.35).add(0.15), intimate.mul(0.7).add(0.3)).mul(loopOsc(1, latticeRnd.z.mul(TAU)).mul(0.4).add(0.8))
    const fire = mix(smooth.fire.mul(1.05), patched.fire, fineFlames.mul(resolved).min(1).mul(domainMask)).mul(fireMask).mul(facing.pow(0.45).add(0.25))
    const potch = mx_noise_float(p.mul(3.4).add(31)).mul(0.5).add(0.5)
    const body = mix(color('#050409'), color('#2b2429'), potch.mul(bandTone.mul(0.55).add(0.2)))
    const spheres = glitter(p, 0.0065, 70, 0.8)
    const sphereCoord = p.div(0.0065)
    const sphereCenter = cellNoiseVec3(sphereCoord.floor()).mul(0.5).add(0.25)
    const sphereRadius = sphereCoord.fwidth().length().add(0.18).min(0.24)
    const sphereMask = sphereCoord.fract().sub(sphereCenter).length().smoothstep(0.06, sphereRadius).oneMinus()
    this.colorNode = mix(body, color('#6a737f'), potch.smoothstep(0.78, 0.96).mul(0.4)).add(color('#141220').mul(bandTone.mul(0.3)))
    this.metalness = 0
    this.roughnessNode = float(0.05).add(potch.smoothstep(0.7, 0.95).mul(0.12)).add(near.mul(-0.012)).clamp(0.03, 0.2)
    this.ior = 1.45
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(120)).mul(0.02), 0.00035)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = fire.mul(2.1)
      .add(color('#ffe3b0').mul(spheres.sparkle).mul(sphereMask).mul(intimate).mul(0.45))
      .add(color('#3b2f4a').mul(patched.weight.min(1)).mul(domainMask).mul(resolved).mul(0.12))
  }
}
