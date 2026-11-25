import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, normalLocal, positionGeometry, reflectVector, time, uv, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {starfield} from '../../lib/starfield.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A ring of spacetime. The surface is a dark membrane that carries a lensed sky: stars are dragged into arcs around the tube and the whole field slides as the viewer moves. A band of infalling plasma wraps the ring, white-hot on the approaching side and dimmed on the receding one, and the silhouette is drawn by a thin photon ring that never quite resolves. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, view, grazing, intimate} = viewerFrame()
    const tube = uv()
// The sky, seen through a membrane that bends it.
    const lens = mx_noise_vec3(p.mul(2.2)).mul(0.45).add(normalLocal.mul(0.35))
    const skyDirection = reflectVector.add(lens).normalize()
    const sky = starfield(skyDirection, 9, 0.9)
    const skyFine = starfield(skyDirection.mul(1.7).add(vec3(11.3, 4.1, 7.7)), 22, 0.93).mul(intimate)
// The accretion band: a stripe of infalling plasma around the ring.
    const bandPhase = tube.y.mul(TAU)
    const band = bandPhase.cos().mul(0.5).add(0.5)
    const bandEdge = band.smoothstep(0.35, 0.95)
// Turbulence inside the band, sheared along the flow. The tube's u coordinate
// wraps, so the noise is fed a periodic pair rather than a raw phase.
    const shear = tube.x.mul(TAU * 9).sub(time.mul(1.6))
    const flow = vec3(shear.sin(), shear.cos(), bandPhase.mul(1.4))
    const turbulence = mx_noise_float(flow.mul(2.2).add(vec3(0, 0, time.mul(0.12)))).mul(0.5).add(0.5)
    const filaments = mx_noise_float(vec3(flow.x.mul(1.7), flow.y.mul(1.7), flow.z.mul(2.2)).add(vec3(0, 0, time.mul(0.2)))).mul(0.5).add(0.5)
    const plasma = bandEdge.mul(turbulence.mul(0.6).add(filaments.mul(0.4)))
// Doppler beaming: the side sweeping toward the viewer burns brighter.
    const doppler = view.dot(vec3(0.62, 0.18, 0.76).normalize()).mul(0.5).add(0.5)
    const beamed = plasma.mul(doppler.pow(1.6).mul(1.5).add(0.35))
    const hot = mix(mix(color(hsl.integer(33.6, 100, 59.5)), color(hsl.integer(72.3, 100, 78.4)), turbulence), color(hsl.integer(88, 100, 97)), filaments.pow(2))
// The photon ring: a hairline of light exactly on the silhouette.
    const photonRing = grazing.pow(9).mul(1.4).add(grazing.pow(3).mul(0.12))
    const membrane = mix(color(hsl.integer(281, 53, 2)), color(hsl.integer(284, 32, 6)), mx_noise_float(p.mul(6)).mul(0.5).add(0.5))
    this.colorNode = membrane.add(sky.mul(0.5)).add(skyFine.mul(0.4)).add(hot.mul(beamed).mul(0.05))
    this.metalness = 0.1
    this.roughnessNode = float(0.55).sub(beamed.mul(0.4)).clamp(0.08, 0.6)
    this.specularIntensity = 0.3
    this.clearcoat = 0.25
    this.clearcoatRoughness = 0.06
    this.iridescence = 0.2
    this.iridescenceIOR = 1.4
    this.iridescenceThicknessNode = grazing.mul(240).add(180)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(30)).mul(0.5).add(0.5).mul(0.4), 0.0004)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = hot.mul(beamed).mul(2.2).add(color(hsl.integer(0, 0, 100)).mul(photonRing).mul(1.6)).add(sky.mul(1.1)).add(skyFine.mul(1.4)).add(color(hsl.integer(296, 79, 21)).mul(grazing.pow(3)).mul(0.1))
    this.positionNode = positionGeometry.add(normalLocal.mul(beamed.mul(0.0012)))
  }
}
