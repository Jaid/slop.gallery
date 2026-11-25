import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, cos, max, mix, mx_fractal_noise_float, normalLocal, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A fallen century, colonized: gill lanterns breathing on a web of mycelium, with spores adrift. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const normal = normalLocal
// The substrate: split heartwood, fibrous along the grain and pitted with old wounds.
    const tubeUv = uv()
    const grain = tubeUv.mul(vec2(7, 52))
    const fibre = mx_fractal_noise_float(vec3(grain, grain.x.mul(0.3)), 3, 2.2, 0.5).mul(0.5).add(0.5)
    const wound = mx_fractal_noise_float(p.mul(6.5), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const rot = wound.smoothstep(0.62, 0.9)
// Mycelium: a warp that follows the fibres, then the zero set of the warped field.
    const warp = mx_fractal_noise_float(p.mul(4.2), 2, 2.1, 0.5).mul(0.32)
    const threads = filament(mx_fractal_noise_float(p.mul(16).add(vec3(warp, fibre.mul(0.4), warp.mul(0.7))), 3, 2.2, 0.5), 0.05)
    const veins = filament(mx_fractal_noise_float(p.mul(44).add(threads.mul(0.9)), 2, 2.3, 0.5), 0.04).mul(near.mul(0.6).add(0.4))
    const web = max(threads, threads.mul(0.3).add(veins.mul(0.75)))
// Fruiting bodies: a lattice of gill lanterns, each breathing on its own slow rhythm.
    const lattice = p.mul(7)
    const cell = lattice.floor()
    const jitter = cellNoiseVec3(cell.mul(0.83)).sub(0.5).mul(0.5)
    const local = lattice.fract().sub(0.5).sub(jitter)
    const identity = cellNoiseVec3(cell.mul(1.37).add(2.6))
    const present = identity.z.smoothstep(0.44, 0.58)
    const radius = identity.x.pow(2).mul(0.3).add(0.16)
    const distance = local.length()
    const capProfile = distance.div(radius).clamp(0, 1)
    const dome = capProfile.mul(capProfile).oneMinus().max(0).sqrt()
    const pulse = time.mul(identity.y.mul(0.5).add(0.35)).add(identity.x.mul(TAU)).sin().mul(0.16).add(0.84)
    const gills = cos(atan(local.y, local.x).mul(9).add(identity.y.mul(TAU))).mul(0.5).add(0.5).pow(1.6)
    const gillGlow = gills.mul(0.55).add(0.45).mul(distance.smoothstep(radius.mul(0.3), radius.mul(0.98)).oneMinus())
    const rimGlow = distance.smoothstep(radius.mul(0.72), radius.mul(0.99)).oneMinus().mul(distance.smoothstep(radius.mul(0.99), radius.mul(0.88)).oneMinus().mul(0.5).add(0.5))
    const cap = capProfile.mul(present).mul(pulse)
// Spores: motes of light released into the still air above the wood.
    const drift = vec3(time.mul(0.06), time.mul(-0.34), time.mul(0.02))
    const spore = beads(p.mul(34).add(normal.mul(cellNoiseVec3(p.mul(3.1)).mul(2.4)).add(drift)), 7.7)
    const sporeGlow = spore.core.mul(intimate)
// The bark lifts a little where the flesh pushes through it.
// Only the smooth, derivative-free relief reaches the vertex stage; the web is a normal-map concern.
    const cushion = dome.mul(present).mul(pulse).mul(0.9).add(rot.mul(0.1))
    this.positionNode = positionGeometry.add(normalLocal.mul(cushion.mul(knotData.displacement)))
    const bark = mix(color(hsl.integer(302, 16, 4)), color(hsl.integer(59, 29, 10)), fibre.mul(0.8).add(0.1))
    const decay = mix(bark, color(hsl.integer(70, 39, 26)), rot.mul(0.6))
// A cap is dark on top and lit from beneath; only the gills carry the light out.
    const flesh = mix(color(hsl.integer(65, 45, 7)), color(hsl.integer(71, 47, 20)), dome.pow(0.6).mul(0.5))
    this.colorNode = mix(decay, flesh, cap.mul(0.8)).sub(web.mul(0.08))
    this.metalness = 0
    this.roughnessNode = cap.mul(0.12).add(rot.mul(0.18)).add(fibre.mul(0.12)).add(0.62).clamp(0.35, 0.96)
    this.normalNode = proceduralNormal(web.mul(0.18).add(dome.mul(present).mul(0.5)).add(fibre.mul(0.06)).add(gills.mul(capProfile).mul(0.1)), 0.24)
    const amber = color(hsl.integer(68, 99, 79.4))
    const honey = color(hsl.integer(78, 100, 89))
    const deep = color(hsl.integer(56, 83, 40))
    this.emissiveNode = amber.mul(web.mul(0.85))
      .add(amber.mul(gillGlow.mul(present).mul(pulse).mul(2.4)))
      .add(color(hsl.integer(166, 72, 86.3)).mul(gills.mul(gillGlow).mul(present).mul(pulse).mul(2)))
      .add(deep.mul(rimGlow.mul(present).mul(pulse).mul(3.2)))
      .add(honey.mul(dome.mul(present).mul(pulse).mul(grazing.pow(2.4))).mul(1.3))
      .add(honey.mul(sporeGlow).mul(2.4))
      .add(amber.mul(web.mul(grazing.pow(2))).mul(0.7))
  }
}
