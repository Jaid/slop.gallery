import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, cross, float, mix, mx_noise_float, normalLocal, tangentLocal, uv, vec2, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Lunar Silk. A plain weave of two very different yarns: a pale silver warp and a deep indigo weft. Because the two yarns run at right angles their anisotropic highlights never fire together, so the cloth reads silver from one side of the gallery and midnight blue from the other. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const {p, view, facing, grazing} = viewerFrame()
    const tube = uv()
    const threadsU = 1100
    const threadsV = 150
    const i = tube.x.mul(threadsU)
    const j = tube.y.mul(threadsV)
    const cellI = i.floor()
    const cellJ = j.floor()
// Plain weave: the warp floats over the weft on every other crossing.
    const warpUp = cellI.add(cellJ).mod(2)
    const fu = i.fract().sub(0.5)
    const fv = j.fract().sub(0.5)
// Rounded yarn cross-sections, one perpendicular to each yarn direction.
    const warpProfile = fv.abs().mul(2).oneMinus().max(0).sqrt()
    const weftProfile = fu.abs().mul(2).oneMinus().max(0).sqrt()
// Slubs and filament striations: silk is never perfectly even.
    const slub = mx_noise_float(p.mul(23)).mul(0.16).add(0.9)
    const striation = mx_noise_float(p.mul(210)).mul(0.5).add(0.5)
// The yarn that floats sits high; the one that dives under sits low.
    const warpCrimp = warpProfile.mul(warpUp.mul(0.55).add(0.45))
    const weftCrimp = weftProfile.mul(warpUp.oneMinus().mul(0.55).add(0.45))
    const height = warpCrimp.max(weftCrimp).mul(slub)
// Once the weave falls below a pixel the relief must dissolve into roughness
// instead of sparkling, so the bump fades out with the screen footprint.
    const weaveFootprint = fu.fwidth().max(fv.fwidth())
    const reliefFade = weaveFootprint.smoothstep(0.04, 0.18).oneMinus()
    this.positionNode = p.add(normalLocal.mul(height.mul(0.00025)))
// The yarn direction is the anisotropy axis, so each crossing throws its own streak.
    this.anisotropy = 0.95
    this.anisotropyNode = vec2(warpUp, warpUp.oneMinus())
// The body of the cloth is indigo; the silver lives almost entirely in the sheen.
    const warpColor = color(hsl.integer(267, 100, 97))
    const weftColor = color(hsl.integer(271, 78, 8))
    const warpView = view.dot(tangentLocal).abs()
// The published types describe the bitangent accessors as untyped math nodes.
    const weftView = view.dot(cross(normalLocal, tangentLocal)).abs()
    const shot = warpView.sub(weftView).mul(0.5).add(0.5)
    const yarn = mix(weftColor, warpColor, vec3(warpUp.mul(0.14).add(shot.mul(0.16))))
    this.colorNode = yarn.mul(striation.mul(0.14).add(0.93))
    this.metalness = 0.04
    this.roughnessNode = float(0.22).add(slub.mul(0.05)).sub(striation.mul(0.04)).add(reliefFade.oneMinus().mul(0.12))
    this.sheen = 1
    this.sheenColor.set(hsl.integer(272, 100, 93.5))
    this.sheenRoughnessNode = float(0.18).add(striation.mul(0.1))
    this.ior = 1.55
    this.clearcoat = 0.08
    this.clearcoatRoughness = 0.2
    this.aoNode = height.smoothstep(0.15, 0.95).mul(0.5).add(0.5)
    this.normalNode = proceduralNormal(height.mul(0.22).mul(reliefFade).add(striation.mul(0.03)), 0.0016)
    this.emissiveNode = color(hsl.integer(273, 99, 65)).mul(grazing.pow(3)).mul(0.14)
      .add(color(hsl.integer(81, 100, 93.3)).mul(facing.pow(6)).mul(0.05))
  }
}
