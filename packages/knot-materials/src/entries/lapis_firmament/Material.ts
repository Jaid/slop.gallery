import type {Node, Texture} from 'three/webgpu'

import {float, mix, mx_fractal_noise_float, mx_fractal_noise_vec3, mx_noise_float, normalLocal, normalViewGeometry, tangentLocal, time, transformNormalToView, vec3} from 'three/tsl'

import {below} from '../../candidates/claude_opus/lib/below.ts'
import {environmentHighlight} from '../../candidates/claude_opus/lib/environmentHighlight.ts'
import {rgb} from '../../candidates/claude_opus/lib/rgb.ts'
import {voronoi} from '../../candidates/claude_opus/lib/voronoi3dStruct.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const pyrite = rgb('#e8c060')
/** Polished lapis lazuli. Lazurite's ultramarine is mottled into deeper and brighter domains and veiled by drifting calcite clouds; pyrite crystals are scattered through it in clusters, each a tiny cube with its own facet tilt, so every step flips which ones blaze gold. The finest pyrite dust is beyond sight from across the room – it wakes star by star as a visitor approaches, and twinkles slowly while they stay. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, facing, near, intimate, distance} = viewerFrame()
    const n = normalLocal.normalize()
    const alongDirection = tangentLocal.xyz.normalize()
    const sideDirection = n.cross(alongDirection).normalize()
// Lazurite: ultramarine domains drifting between deep indigo and a brighter royal blue, with violet-leaning patches.
    const warp = mx_fractal_noise_vec3(p.mul(2.2), 2, 2, 0.5).mul(0.25)
    const domains = mx_fractal_noise_float(p.add(warp).mul(5.5), 4, 2.1, 0.55).mul(0.5).add(0.5)
    const violet = mx_noise_float(p.mul(1.7).add(9.1)).mul(0.5).add(0.5).smoothstep(0.55, 0.8)
// Fine mineral grain: individual lazurite and sodalite crystals, a few paler, most deep.
    const grainCoordinate = p.mul(240)
    const grain = mx_noise_float(grainCoordinate).mul(grainCoordinate.fwidth().length().smoothstep(0.4, 1).oneMinus()).mul(0.18).add(1)
    const lazurite = mix(mix(rgb('#050a30'), rgb('#12248c'), domains.smoothstep(0.25, 0.85)), rgb('#1e1570'), violet.mul(0.45)).mul(grain)
// Calcite: soft white clouds and wispy veins, bluish where thin.
    const veinField = mx_fractal_noise_float(p.add(warp.mul(1.6)).mul(3.3), 3, 2, 0.5)
    const veinWidth = mx_noise_float(p.mul(7)).mul(0.03).add(0.045)
    const veins = veinField.abs().add(mx_fractal_noise_float(p.mul(40), 2, 2, 0.5).mul(0.02)).smoothstep(veinWidth.mul(0.5), veinWidth).oneMinus().mul(mx_noise_float(p.mul(1.4).add(3.3)).smoothstep(0.1, 0.5))
// Crystalline margins: the cloud edge is broken by fine noise rather than airbrushed.
    const clouds = mx_fractal_noise_float(p.add(warp).mul(2.4).add(20), 3, 2, 0.5).mul(0.5).add(0.5).add(mx_fractal_noise_float(p.mul(55), 2, 2, 0.5).mul(0.05)).smoothstep(0.74, 0.8)
    const calcite = veins.mul(0.8).max(clouds.mul(0.7)).clamp()
    const calciteColor = mix(rgb('#8f9bc6'), rgb('#d9dde6'), calcite)
// Pyrite: clusters of cubes, each with its own facet tilt.
// Pyrite gathers in stringers along the calcite margins and in a few rich patches.
    const margin = calcite.mul(calcite.oneMinus()).mul(4)
    const clusterDensity = mx_fractal_noise_float(p.mul(3.1).add(40), 2, 2, 0.5).mul(0.5).add(0.5).smoothstep(0.55, 0.85).max(margin.mul(0.9))
    const pyriteLayer = (scale: number, chance: Node<'float'>, sizeRange: [number, number], seed: number) => {
      const cells = voronoi(p.mul(scale).add(seed), 0.75)
      const rotation = cells.random.z.mul(TAU)
      const axisA = alongDirection.mul(rotation.cos()).add(sideDirection.mul(rotation.sin()))
      const axisB = n.cross(axisA)
// Polished sections through cubes: squares, sheared and chipped by a little warping.
      const offset = cells.toFeature.negate().add(mx_fractal_noise_vec3(p.mul(scale * 2.5), 2, 2, 0.5).mul(0.07))
// A square cross-section: Chebyshev distance in the crystal's own axes.
      const square = offset.dot(axisA).abs().max(offset.dot(axisB).abs())
      const size = cells.random.y.mul(sizeRange[1] - sizeRange[0]).add(sizeRange[0])
      const footprint = square.fwidth().max(1e-4)
      const present = below(cells.random.x, chance)
      const crystal = square.smoothstep(size.sub(footprint), size.add(footprint)).oneMinus().mul(present).mul(p.mul(scale).fwidth().length().smoothstep(0.3, 0.75).oneMinus())
      const tilt = cells.random.sub(0.5).mul(1.3)
      const facetNormal = n.add(axisA.mul(tilt.x)).add(axisB.mul(tilt.y)).normalize()
      return {
        crystal,
        facetNormal,
        random: cells.random,
      }
    }
    const coarse = pyriteLayer(26, clusterDensity.mul(0.55).add(0.01), [0.08, 0.2], 0)
    const fine = pyriteLayer(70, clusterDensity.mul(0.6).add(0.03), [0.07, 0.17], 17.3)
// The dust wakes star by star as the visitor approaches: each grain has its own distance at which it appears.
    const dust = pyriteLayer(170, float(0.35), [0.1, 0.2], 41.9)
    const wakeDistance = dust.random.x.mul(1.6).add(0.9)
    const awake = distance.smoothstep(wakeDistance.add(0.4), wakeDistance).mul(dust.crystal)
    const twinkle = time.mul(dust.random.y.mul(1.5).add(0.4)).add(dust.random.z.mul(TAU)).sin().mul(0.5).add(0.5)
    const pyriteMask = coarse.crystal.max(fine.crystal)
    const facetNormal = mix(fine.facetNormal, coarse.facetNormal, coarse.crystal).normalize()
// Assemble: calcite over lazurite, pyrite set into both.
    const stone = mix(lazurite, calciteColor, calcite)
    this.colorNode = mix(stone, pyrite, pyriteMask)
    this.metalnessNode = pyriteMask
    this.roughnessNode = mix(mix(float(0.55), float(0.6), calcite), float(0.12), pyriteMask)
// The polish lives in the clearcoat; the stone's own specular stays faint, so there is no broad plastic sheen.
    this.specularIntensityNode = mix(float(0.25), float(1), pyriteMask)
    this.clearcoatNode = pyriteMask.oneMinus()
    this.clearcoatRoughness = 0.03
    this.clearcoatNormalNode = normalViewGeometry
// Polishing leaves hard pyrite slightly proud and soft calcite slightly low.
    const surfaceNormalLocal = mix(n, facetNormal, pyriteMask).normalize()
    this.normalNode = mix(proceduralNormal(calcite.mul(-0.3).add(domains.mul(0.08)), 0.0008), transformNormalToView(surfaceNormalLocal), pyriteMask).normalize()
    const facetView = transformNormalToView(facetNormal)
    const flash = glints(facetView, 180).add(environmentHighlight(environment, facetNormal, 0.04, {threshold: 1.4}).dot(vec3(0.3, 0.5, 0.2)).mul(2))
    const dustFlash = glints(transformNormalToView(dust.facetNormal), 220).mul(0.8).add(twinkle.pow(4).mul(0.9))
    this.emissiveNode = pyrite.mul(flash).mul(pyriteMask).mul(near.mul(0.6).add(0.7))
      .add(pyrite.mul(dustFlash).mul(awake).mul(intimate.mul(0.8).add(0.5)))
      .add(lazurite.mul(0.06).mul(facing))
  }
}
