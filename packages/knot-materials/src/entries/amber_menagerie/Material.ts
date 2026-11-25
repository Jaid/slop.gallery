import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Warm translucent amber encloses pollen, bubbles, ancient seeds, and tiny imagined organisms at different depths. Parallax reveals hidden specimens as you orbit. Some appear to awaken when observed closely — legs twitch, wings catch light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    // Amber body — warm translucent resin with internal color variations
    const amberNoise = mx_noise_float(p.mul(4)).mul(0.5).add(0.5)
    const amberFlow = mx_noise_float(p.mul(vec3(2, 8, 2))).mul(0.5).add(0.5)
    // Surface imperfections — tiny scratches and polish marks
    const scratchField = mx_noise_float(p.mul(55)).mul(0.5).add(0.5)
    const polishMarks = mx_noise_float(p.mul(30).add(7.7)).mul(0.5).add(0.5)
    // Three depth layers of inclusions, each with parallax offset
    const depths = [0.06, 0.16, 0.28] as const
    const scales = [48, 35, 25] as const
    let inclusionMask: Node<'float'> = float(0)
    let inclusionEmission: Node<'vec3'> = vec3(0)
    for (const [layerIdx, depth] of depths.entries()) {
      const scale = scales[layerIdx]
      const q = p.sub(view.mul(depth))
      // Cellular placement of inclusions
      const coord = q.mul(scale)
      const cell = coord.floor()
      const rnd = cellNoiseVec3(cell)
      const rnd2 = cellNoiseVec3(cell.add(23.5))
      const center = rnd.mul(0.4).add(0.3)
      const local = coord.fract().sub(center)
      const fw = coord.fwidth().length().max(0.001)
      // Inclusion shape — varies per cell: round (pollen), elongated (insects), irregular (seeds)
      const shapeType = rnd2.x
      // Stretch factor for elongated specimens
      const stretch = mix(float(1), float(2.2), shapeType.smoothstep(0.5, 0.7))
      const angle = rnd2.y.mul(Math.PI * 2)
      const rotX = local.x.mul(angle.cos()).add(local.y.mul(angle.sin()))
      const rotY = local.x.mul(angle.sin().negate()).add(local.y.mul(angle.cos()))
      const shapeDist = vec3(rotX.mul(stretch), rotY, local.z).length()
      const radius = float(0.08).add(rnd.x.mul(0.06))
      const inclusion = shapeDist.smoothstep(radius.add(fw), radius)
        .mul(fw.smoothstep(0.2, 0.5).oneMinus())
      // Activation gate — sparse inclusions
      const gate = mx_cell_noise_float(cell.add(layerIdx * 100)).smoothstep(0.55, 0.6)
      const maskedInclusion = inclusion.mul(gate)
      // Different inclusion types have different colors
      const pollenColor = color(hsl.integer(95, 84, 81))
      const insectColor = color(hsl.integer(61, 60, 13))
      const seedColor = color(hsl.integer(65, 65, 28))
      const leafColor = color(hsl.integer(132, 87, 34))
      const typeColor = mix(
        mix(pollenColor, insectColor, shapeType.smoothstep(0.3, 0.6)),
        mix(seedColor, leafColor, shapeType.smoothstep(0.7, 0.9)),
        shapeType.smoothstep(0.5, 0.55),
      )
      // Tiny movement for "awakening" specimens when viewed closely
      const twitch = time.mul(rnd2.z.mul(3).add(1.5)).sin()
        .mul(0.3)
        .mul(intimate)
        .mul(shapeType.smoothstep(0.4, 0.65)) // only insect-like shapes move
      const layerDepthFade = float(1 - layerIdx * 0.2) // deeper layers slightly dimmer
      const layerNear = layerIdx === 0 ? near.mul(0.4).add(0.6) : (layerIdx === 1 ? near.mul(0.6).add(0.4) : near)
      inclusionMask = inclusionMask.add(maskedInclusion.mul(layerDepthFade).mul(layerNear))
      inclusionEmission = inclusionEmission.add(
        typeColor.mul(maskedInclusion).mul(layerDepthFade).mul(twitch.mul(0.5).add(0.5)),
      )
    }
    inclusionMask = inclusionMask.clamp()
    // Bubbles — round inclusions with bright rim highlights
    const bubbleQ = p.sub(view.mul(0.12))
    const bubbleCoord = bubbleQ.mul(65)
    const bubbleCell = bubbleCoord.floor()
    const bubbleRnd = cellNoiseVec3(bubbleCell)
    const bubbleCenter = bubbleRnd.mul(0.4).add(0.3)
    const bubbleDist = bubbleCoord.fract().sub(bubbleCenter).length()
    const bubbleFw = bubbleCoord.fwidth().length().max(0.001)
    const bubbleRadius = bubbleRnd.x.mul(0.04).add(0.03)
    const bubble = bubbleDist.smoothstep(bubbleRadius.add(bubbleFw), bubbleRadius)
      .mul(mx_cell_noise_float(bubbleCell.add(200)).smoothstep(0.75, 0.78))
      .mul(bubbleFw.smoothstep(0.15, 0.4).oneMinus())
    const bubbleRim = bubbleDist.smoothstep(bubbleRadius.mul(0.7), bubbleRadius)
      .mul(bubble)
    const bubbleHighlight = bubbleDist.smoothstep(bubbleRadius.mul(0.35), bubbleRadius.mul(0.2))
      .mul(bubble)
    // Amber colors — warm honey gradient with depth variations
    const amberLight = color(hsl.integer(78, 88, 73.6))
    const amberMid = color(hsl.integer(65, 89, 58))
    const amberDeep = color(hsl.integer(57, 87, 40))
    const amberColor = mix(
      mix(amberLight, amberMid, amberNoise.mul(0.6)),
      amberDeep,
      amberFlow.mul(0.35),
    )
    // Surface color darkens slightly where inclusions are
    this.colorNode = mix(amberColor, amberColor.mul(0.6), inclusionMask.mul(0.4))
    // Amber is transparent resin
    this.transmission = 0.75
    this.thickness = 1.2
    this.ior = 1.546
    this.attenuationColor.set(hsl.integer(68, 89, 64))
    this.attenuationDistance = 0.8
    this.metalness = 0
    this.roughnessNode = float(0.06)
      .add(scratchField.smoothstep(0.7, 0.8).mul(0.08))
      .add(polishMarks.smoothstep(0.75, 0.85).mul(0.04))
      .clamp(0.03, 0.18)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    // Subtle surface normals from polish imperfections
    this.normalNode = proceduralNormal(
      scratchField.mul(0.3).add(polishMarks.mul(0.2)),
      0.0003,
    )
    // Emissive — inclusions caught in light, bubble highlights, warm interior glow
    const interiorP = p.sub(view.mul(0.2))
    const interiorLight = mx_noise_float(interiorP.mul(3).add(vec3(time.mul(0.03), 0, 0)))
      .mul(0.5).add(0.5)
    const caustic = interiorLight.smoothstep(0.55, 0.85).mul(facing.pow(2))
    this.emissiveNode = inclusionEmission.mul(near.mul(0.5).add(0.3)).mul(0.4)
      .add(color(hsl.integer(88, 100, 92.5)).mul(bubbleHighlight).mul(near).mul(0.6))
      .add(color(hsl.integer(0, 0, 100)).mul(bubbleRim).mul(grazing.pow(2)).mul(0.3))
      .add(color(hsl.integer(69, 100, 76.7)).mul(caustic).mul(intimate).mul(0.15))
      .add(color(hsl.integer(87, 75, 80)).mul(grazing.pow(4)).mul(0.08))
  }
}
