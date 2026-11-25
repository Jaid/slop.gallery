import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, negateOnBackSide, uv, vec2} from 'three/tsl'

import {breath, tangentViewFrame} from '../../candidates/gpt_sol/lib/exhibition/facetOptics.ts'
import {fill, polarAngle, stroke, tiles, wave} from '../../candidates/gpt_sol/lib/exhibition/patterns.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Three enamel illustrations multiplexed beneath microscopic cylindrical optical lenses. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = data.id
    const tube = uv()
    const {grazing, intimate, near} = viewerFrame()
    const {T, B, N, along, across} = tangentViewFrame()
    const cell = tiles(tube, 20, 4, 44.5)
    const p = cell.point.mul(vec2(1.6, 1))
    const radius = p.length()
    const angle = polarAngle(p)
    const aa = cell.footprint.mul(1.6)
    // Garden I: vermilion poppies, pale centers and fine cream contour ink.
    const poppyBoundary = radius.sub(angle.mul(5).cos().mul(0.08).add(0.29))
    const poppy = fill(poppyBoundary, aa)
    const poppyEdge = stroke(poppyBoundary, 0.008, aa)
    const center = fill(radius.sub(0.08), aa)
    const petalInk = stroke(angle.mul(5).sin().mul(radius), 0.006, aa)
      .mul(radius.smoothstep(0.07, 0.18)).mul(poppy)
    let gardenA = mix(color(hsl.integer(262, 52, 13)), mix(color(hsl.integer(21, 89, 40)), color(hsl.integer(33, 94, 67)), radius.div(0.4).clamp()), poppy)
    gardenA = mix(gardenA, color(hsl.integer(82, 100, 91)), center.max(poppyEdge.mul(0.7)))
    gardenA = mix(gardenA, color(hsl.integer(353, 56, 19)), petalInk.mul(0.6))
    // Garden II: jade pools nested inside scalloped, gold-rimmed wave scales.
    const poolPoint = p.sub(vec2(0, -0.23))
    const poolRadius = poolPoint.length()
    const poolPhase = poolRadius.mul(62)
    const poolLines = stroke(poolPhase.sin(), 0.05, poolPhase.fwidth())
    const pool = fill(poolRadius.sub(0.58), aa)
    const poolColor = mix(color(hsl.integer(192, 86, 27)), color(hsl.integer(172, 65, 72)), wave(poolPhase).mul(0.5).add(0.5))
    let gardenB = mix(color(hsl.integer(218, 90, 18)), poolColor, pool)
    gardenB = mix(gardenB, color(hsl.integer(92, 65, 88)), poolLines.mul(pool).mul(0.72))
    gardenB = mix(gardenB, color(hsl.integer(92, 57, 92)), fill(radius.sub(0.045), aa))
    // Garden III: ivory leaves with saffron medallions and blue-black diagonal hatching.
    const leafDistance = p.mul(vec2(0.9, 1.7)).length().sub(0.35)
    const leaf = fill(leafDistance, aa)
    const hatchPhase = p.x.add(p.y.mul(0.6)).mul(90)
    const hatch = wave(hatchPhase).smoothstep(0.3, 0.8).mul(leaf)
    let gardenC = mix(color(hsl.integer(88, 49, 88)), color(hsl.integer(80, 89, 71)), leaf)
    gardenC = mix(gardenC, color(hsl.integer(242, 54, 19)), hatch.mul(0.65))
    gardenC = mix(gardenC, color(hsl.integer(220, 44, 20)), stroke(leafDistance, 0.008, aa))
    // Snell-like angular routing. The image changes with signed tangent direction, not just Fresnel.
    const direction = along.mul(1.6).add(across.mul(0.3)).add(breath.sin().mul(0.035)).toVar()
    const left = direction.smoothstep(-0.6, -0.08)
    const right = direction.smoothstep(0.08, 0.6)
    const image = mix(mix(gardenA, gardenB, left), gardenC, right).toVar()
    const lensPhase = tube.x.mul(TAU * 540)
    const lensVisibility = lensPhase.fwidth().smoothstep(0.5, 2.5).oneMinus()
    const lens = wave(lensPhase).toVar()
    const grooves = lens.mul(0.5).add(0.5).pow(8).mul(lensVisibility)
    const copperEdge = stroke(p.x.abs().sub(0.75), 0.005, aa).mul(0.8)
    this.colorNode = mix(image.mul(grooves.mul(-0.12).add(0.98)), color(hsl.integer(82, 63, 77)), copperEdge)
    this.metalnessNode = copperEdge.mul(0.68).add(0.15)
    this.roughnessNode = float(0.24).sub(near.mul(0.035)).add(grooves.mul(0.035))
    this.normalNode = negateOnBackSide(N.add(T.mul(lensPhase.sin()).mul(lensVisibility).mul(0.12))
      .add(B.mul(angle.mul(5).sin()).mul(poppy).mul(0.015)).normalize())
    this.clearcoat = 1
    this.clearcoatRoughness = 0.07
    this.clearcoatNormalNode = negateOnBackSide(N.add(T.mul(lensPhase.sin()).mul(lensVisibility).mul(0.055)).normalize())
    this.ior = 1.49
    this.anisotropy = 0.72
    this.anisotropyNode = vec2(0, 0.72)
    // Light trapped between the enamel and the lenses, held well below the reflected highlights.
    this.emissiveNode = image.mul(0.055).mul(grazing.mul(0.25).add(0.75))
      .add(color(hsl.integer(77, 76, 79.4)).mul(copperEdge).mul(intimate).mul(0.018))
    this.userData = {
      collection: 'The Unwritten Atlas',
      opticalEffect: 'three-view lenticular enamel',
    }
  }
}
