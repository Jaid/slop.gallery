import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalViewGeometry, time, uv, vec2} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.25)
    this.name = knotData.id
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    // Seamless overlapping scalloped armor scales
    // Integer periods along both coordinates ensure seamless UV wrapping
    const scaleU = tube.x.mul(48)
    const scaleV = tube.y.mul(8)
    const rowIndex = scaleV.floor()
    const stagger = rowIndex.mod(2).mul(0.5)
    const gridU = scaleU.add(stagger)
    const cellU = gridU.fract().sub(0.5)
    const cellV = scaleV.fract().sub(0.5)
    // Curved scalloped scale profile: arched anterior edge and overlapping posterior rim
    const scaleDist = vec2(cellU.mul(1.15), cellV.add(cellU.pow(2).mul(0.75))).length()
    const scaleFootprint = scaleDist.fwidth().max(0.0001)
    // Shingled scale shield mask
    const scaleProfile = scaleDist.smoothstep(float(0.48), float(0.15))
    const scaleBevel = scaleDist.smoothstep(float(0.42), float(0.42).add(scaleFootprint.mul(1.2)).add(0.06))
    const intersegmentSeam = scaleDist.smoothstep(float(0.46), float(0.52))
    // Bouligand helicoidal structural coloration:
    // stacked microfibril pitch reflects emerald at normal angles and shifts to topaz and deep sapphire
    const bouligandPhase = facing.mul(3.2).add(0.35).add(scaleProfile.mul(0.4))
    const structuralColor = cosinePalette(
      bouligandPhase,
      [0.24, 0.58, 0.42],
      [0.38, 0.44, 0.48],
      [1, 1, 1],
      [0.15, 0.42, 0.76],
    )
    // Cuticle micro-punctures (pore canals) scattered across each plate
    const poreCoord = p.mul(110)
    const poreNoise = cellNoiseVec3(poreCoord)
    const poreDist = poreCoord.fract().sub(poreNoise.mul(0.5).add(0.25)).length()
    const poreFootprint = poreCoord.fwidth().length().max(0.0001)
    const poreMask = poreDist.smoothstep(float(0.08), float(0.22)).oneMinus()
      .mul(poreFootprint.smoothstep(0.25, 0.85).oneMinus())
      .mul(near)
    // Base chitin and flexible inter-segmental membrane
    const darkCuticle = color(hsl.integer(160, 28, 5))
    const armoredChitin = mix(darkCuticle, structuralColor, scaleProfile.mul(0.92))
    const membraneColor = mix(color(hsl.integer(140, 18, 11)), color(hsl.integer(154, 41, 7)), intersegmentSeam)
    this.colorNode = mix(armoredChitin, membraneColor, intersegmentSeam.mul(0.85))
    this.metalnessNode = scaleProfile.mul(0.84).add(0.12)
    this.roughnessNode = mix(float(0.12), float(0.52), intersegmentSeam).add(poreMask.mul(0.12))
    // Mirror cuticle clearcoat
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    // Chitin thin-film iridescence
    this.iridescence = 1
    this.iridescenceIOR = 1.62
    this.iridescenceThicknessNode = scaleProfile.mul(240).add(360)
    // Procedural normal: beveled scalloped scales with depressed seams and micro-punctures
    const plateHeight = scaleProfile.pow(0.7).mul(0.0038)
      .sub(intersegmentSeam.mul(0.0018))
      .sub(poreMask.mul(0.0005))
    this.normalNode = proceduralNormal(plateHeight, 0.92)
    // Sharp specular sparkle along scale rims
    const scaleGlints = glints(normalViewGeometry, 130).mul(scaleBevel).mul(near.mul(0.6).add(0.4))
    // Bioluminescent respiration in the flexible membranes between armor plates
    const breath = time.mul(1.6).sin().mul(0.5).add(0.5)
    const membraneGlow = color(hsl.integer(163, 100, 86.5))
      .mul(intersegmentSeam)
      .mul(breath.mul(0.4).add(0.6))
      .mul(intimate)
      .mul(0.85)
    // Deep sapphire sheen at acute grazing angles
    const grazingSapphire = color(hsl.integer(265, 93.7, 30)).mul(rim.pow(2.2)).mul(grazing).mul(0.45)
    this.emissiveNode = membraneGlow
      .add(color(hsl.integer(164, 100, 95.8)).mul(scaleGlints).mul(1.6))
      .add(grazingSapphire)
  }
}
