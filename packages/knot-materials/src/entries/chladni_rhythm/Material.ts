import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, mix, modelWorldMatrixInverse, mx_noise_float, normalLocal, normalView, positionGeometry, time, uv, vec2, vec3, vec4} from 'three/tsl'

import {tubeCoordinates} from '../../candidates/claude_haiku/lib/tubeCoordinates.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Sand lattice: grains along the knot and around the tube. Counts are integers so the lattice wraps without a seam. */
const grainsAlong = 574
const grainsAround = 65
const grainPeriod = vec2(grainsAlong, grainsAround)
/** Plate displacement in object units; the tube radius is 0.13. */
const plateDepth = knotData.displacement
/** Chladni's figure on a periodic plate: the nodal lines of a standing wave with m and n periods around each axis. */
const chladni = (u: Node<'float'>, v: Node<'float'>, m: number, n: number) => u.mul(m).cos().mul(v.mul(n).cos()).sub(u.mul(n).cos().mul(v.mul(m).cos()))
/** Two modes crossfade on a two-second loop, so the nodal lines slide through one another as the plate sings. */
const plate = (tube: Node<'vec2'>) => {
  const {along, around} = tubeCoordinates(tube)
  const u = along.mul(TAU)
  const v = around.mul(TAU)
  const morph = time.mul(Math.PI).cos().mul(-0.5).add(0.5)
  return {
    along,
    around,
    shape: mix(chladni(u, v, 3, 5), chladni(u, v, 4, 7), morph),
  }
}
/** Bow strength: swells and relaxes on the two-second loop. */
const excitation = () => time.mul(Math.PI).add(0.9).cos().mul(0.5).add(0.5)

/** A bowed iron plate wrapped around the knot, carrying standing waves whose nodal lines morph over time. Sand gathers on the lines where the metal stays still and gleams as each grain turns toward you; the antinodes glow with a cold resonance. The closer you stand, the harder the plate is driven, so the figure trembles more and the sand scatters. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {near} = viewerFrame()
    const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const proximity = cameraLocal.sub(positionGeometry).length().smoothstep(1, 4.5).oneMinus()
    const drive = excitation().mul(0.45).add(0.55).mul(proximity.mul(0.7).add(0.5))
    this.positionNode = positionGeometry.add(normalLocal.mul(plate(uv()).shape.mul(drive).mul(plateDepth)))
    const {along, around, shape} = plate(uv())
    const nodal = shape.abs().smoothstep(0, 0.28).oneMinus()
    const antinode = shape.abs().smoothstep(0.9, 1.8)
// Sand: one grain per lattice cell, its centre jittered, present with high probability on the nodal lines and rarely elsewhere.
    const lattice = vec2(along.mul(grainsAlong), around.mul(grainsAround))
    const rnd = cellNoiseVec3(vec3(wrapCell(lattice.floor(), grainPeriod), 0.37))
    const centre = vec2(rnd.y, rnd.z).mul(0.5).add(0.25)
    const resolution = lattice.fwidth().length()
    const aa = resolution.mul(0.7).add(0.02)
    const coverage = lattice.fract().sub(centre).length().smoothstep(float(0.3).sub(aa), float(0.3).add(aa)).oneMinus()
    const threshold = mix(float(0.9), float(0.22), nodal)
    const present = rnd.x.smoothstep(threshold, threshold.add(0.06))
// Grains smaller than a pixel dissolve into their average coverage rather than shimmering.
    const resolved = resolution.smoothstep(0.35, 0.7).oneMinus()
    const grain = mix(present.mul(0.28), coverage.mul(present), resolved)
    const streak = mx_noise_float(positionGeometry.mul(40)).mul(0.5).add(0.5)
    const plateTone = mix(color(hsl.integer(63, 21, 5.5)), color(hsl.integer(61, 36, 14)), streak)
    const sandTone = mix(color(hsl.integer(78, 58, 60)), color(hsl.integer(89, 70, 90)), rnd.x)
    this.colorNode = mix(plateTone, sandTone, grain)
    this.metalnessNode = float(0.8).mul(grain.oneMinus())
    this.roughnessNode = mix(float(0.42), float(0.6), grain)
// The bare plate is brushed around the tube; sand is matte.
    this.anisotropyNode = mix(vec2(0, 0.4), vec2(0, 0), grain)
    const normal = proceduralNormal(grain.mul(0.0007).add(shape.mul(plateDepth)), 1)
    this.normalNode = normal
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.2
// Cold resonance at the antinodes, breathing with the bow; sand grains flash white-gold as they turn toward you.
    const sparkle = glints(normalView, 64).mul(grain)
    this.emissiveNode = color(hsl.integer(224, 100, 79)).mul(antinode).mul(excitation().mul(0.25).add(0.05))
      .add(color(hsl.integer(88, 100, 95.5)).mul(sparkle).mul(near.mul(0.7).add(0.2)).mul(0.8))
  }
}
