import {atan, clamp, float, max, select, smoothstep, vec2, vec3} from 'three/tsl'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, corners, middles, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, beadAndReel, legible, repeatPhase} from '../lib/materials/carving.ts'
import FramePaintMaterial from '../lib/materials/FramePaintMaterial.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'
import {turned} from '../lib/ornaments.ts'

const imageDepth = -0.054
const gilt = 0
const white = 1
const jasper = 2
/** the Wedgwood blue frieze, and where its swags hang */
const frieze = {
  from: 0.034,
  to: 0.084,
  z: -0.044,
}
/** a gilt bead at the sight edge, white dentils, a gilt cyma stepping down to a flat frieze of jasper blue, a white bead and a white cove to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], gilt)
  .line(-0.005, -0.044)
  .arc(0.006, -0.044, 0.5)
  .line(0.008, -0.04, {material: white})
  .line(0.026, -0.038)
  .ogee(0.034, frieze.z, {
    reverse: true,
    steps: 8,
    material: gilt,
  })
  .line(frieze.to, frieze.z, {material: jasper})
  .line(0.086, -0.04, {material: white})
  .arc(0.096, -0.04, 0.5)
  .arc(0.108, -0.066, -0.22, {steps: 6})
  .line(0.108, frameBack)
  .line(-0.005, frameBack)
const pateraRadius = 0.021
const patera = () => turned([[pateraRadius, 0], [pateraRadius * 0.95, 0.003], [pateraRadius * 0.8, 0.005], [pateraRadius * 0.45, 0.006], [pateraRadius * 0.3, 0.008], [0, 0.009]], 20, {kind: 1})

/** The Antechamber’s: a neoclassical Adam frame, white mouldings and dentils round a frieze of Wedgwood blue hung with white husk swags, a fluted patera on every corner and middle. */
export default class AdamFrame extends PortraitFrame {
  override readonly description = 'A neoclassical frame in the manner of Robert Adam: white dentils and a gilt cyma round a frieze of Wedgwood jasper blue hung with swags of white husks, a white fluted patera on every corner and in the middle of every member, between gilt and white beads.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#9db1c4'
  override readonly title = 'Adam jasperware'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const middle = (frieze.from + frieze.to) / 2
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [white, place(patera(), corners(halfWidth, halfHeight, middle, frieze.z))],
      [white, place(patera(), middles(halfWidth, halfHeight, middle, frieze.z, {scale: [1.25, 0.85, 1]}))],
    ])
  }

  protected override createMaterials() {
    return [
      new GiltMaterial({
        wear: 0.15,
        relief: {
          depth: 0.002,
          height: surface => {
            const sight = band(surface, -0.005, 0.006)
            return legible(surface, beadAndReel(repeatPhase(surface, 0.014, 0), sight.t), 0.005).mul(sight.inside).mul(0.002)
          },
        },
      }),
      new FramePaintMaterial({
        color: '#eee9dc',
        roughness: 0.55,
        grime: 0.35,
        layers: surface => {
          // Dentils: little blocks with dark gaps between them.
          const dentils = band(surface, 0.01, 0.026)
          const phase = repeatPhase(surface, 0.011, 0.018)
          const block = smoothstep(0.08, 0.14, phase).mul(smoothstep(0.72, 0.66, phase)).mul(smoothstep(0, 0.12, dentils.t)).mul(smoothstep(1, 0.85, dentils.t))
          // A patera’s flutes radiate from its middle.
          const p = vec2(surface.along, surface.across)
          const flutes = atan(p.y, p.x).mul(16).cos().mul(0.5).add(0.5).mul(smoothstep(0.006, 0.01, p.length()))
          const height = select(surface.isOrnament.greaterThan(0.5), legible(surface, flutes, 0.004).mul(0.0012), legible(surface, block, 0.006).mul(dentils.inside).mul(0.002))
          return [{
            mask: float(0),
            color: vec3(1),
            height,
          }]
        },
      }),
      new FramePaintMaterial({
        color: '#8aa3bb',
        roughness: 0.75,
        grime: 0.2,
        layers: surface => {
          // Swags of husks hanging between bows, white on the blue.
          const {t} = band(surface, frieze.from, frieze.to)
          const phase = repeatPhase(surface, 0.09, (frieze.from + frieze.to) / 2)
          const sag = phase.sub(0.5).mul(2)
          const curve = float(0.72).sub(float(1).sub(sag.mul(sag)).mul(0.42))
          const husks = repeatPhase(surface, 0.0075, (frieze.from + frieze.to) / 2).sub(0.5).abs().mul(2)
          const swag = smoothstep(0.1, 0.05, t.sub(curve).abs().add(husks.mul(0.06))).mul(float(1).sub(sag.abs().smoothstep(0.85, 0.95)))
          const bow = smoothstep(0.12, 0.06, vec2(phase.sub(0.5).abs().sub(0.5).mul(1.1), t.sub(0.76)).length())
          const mask = clamp(max(swag, bow), 0, 1)
          return [{
            mask,
            color: vec3(0.86, 0.85, 0.8),
            roughness: 0.55,
            height: mask.mul(0.0007),
          }]
        },
      }),
    ]
  }
}
