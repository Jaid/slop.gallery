import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn as fn, Loop as loop, mix, mx_noise_float, normalViewGeometry, time, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Complete bokeh lights, including discs whose centers lie in neighboring cells. */
const bokehField = fn(([q]: [Node<'vec3'>]) => {
  const cell = q.floor()
  const local = q.fract()
  const footprint = q.fwidth().length()
  const coverage = vec3(0).toVar()
  loop(27, ({i}) => {
    const neighbor = vec3(i.mod(3), i.div(3).mod(3), i.div(9)).sub(1)
    const site = cell.add(neighbor)
    const identity = cellNoiseVec3(site)
    const centre = identity.mul(0.55).add(0.22)
    const radius = identity.z.mul(0.22).add(0.16)
    const distance = local.sub(neighbor.add(centre)).length().div(radius)
    // Cap the filter support so no omitted site can contribute.
    const aa = footprint.div(radius).min(0.2)
    const rim = distance.smoothstep(float(0.86).sub(aa), float(1.02).add(aa)).oneMinus()
    const heart = distance.min(1.02).pow(2).mul(0.5).add(0.55)
    const gate = cellNoiseVec3(site.add(31.7)).x.smoothstep(0.16, 0.34)
    const tint = cellNoiseVec3(site.add(11.3))
    const disc = rim.mul(heart).mul(gate)
    coverage.addAssign(vec3(disc, disc.mul(tint.z), disc.mul(tint.x.smoothstep(0.45, 0.9))))
  })
  return coverage
})
function bokeh(position: Node<'vec3'>, scale: number, seed: number) {
  const coverage = bokehField(position.mul(scale).add(seed))
  return {
    disc: coverage.x,
    cold: coverage.y.div(coverage.x.max(0.000001)),
    warm: coverage.z.div(coverage.x.max(0.000001)),
  }
}

/** A pane of black glass in a rainstorm. The city behind it is a field of out-of-focus lights that slide past as you walk, each bead of rain gathering them into its own small, upside-down lamps, and every rivulet dragging a bright thread of the night down the glass. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.32)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
// Beads of rain: one coarse set that swells and slides, one fine set of drizzle.
    const coarseCells = p.mul(9.5)
    const coarseIdentity = cellNoiseVec3(coarseCells.floor())
    const coarseOffset = coarseCells.fract().sub(coarseIdentity.mul(0.5).add(0.25))
    const coarseDistance = coarseOffset.length()
    const coarseRadius = coarseIdentity.z.mul(0.1).add(0.11)
    const coarseHeight = coarseRadius.mul(coarseRadius).sub(coarseDistance.mul(coarseDistance)).max(0).sqrt()
    const coarseMask = coarseDistance.div(coarseRadius).smoothstep(0.94, 1).oneMinus()
    const fineCells = p.mul(31).add(4.4)
    const fineIdentity = cellNoiseVec3(fineCells.floor())
    const fineDistance = fineCells.fract().sub(fineIdentity.mul(0.5).add(0.25)).length()
    const fineMask = fineDistance.div(fineIdentity.z.mul(0.07).add(0.07)).smoothstep(0.92, 1).oneMinus().mul(near)
// A drop is a lens: it pulls the lights behind it toward its own centre.
    const lens = coarseOffset.div(coarseDistance.max(0.0005)).mul(coarseDistance.div(coarseRadius).pow(2)).mul(coarseMask).mul(0.055)
// Rivulets: threads of water that wander down the glass and drag the light with them.
    const thread = filament(mx_noise_float(p.mul(vec3(2.2, 0.5, 2.2)).add(vec3(0, time.mul(0.05), 0))).mul(1.4).add(p.x.mul(1.1)), 0.05)
    const threadFlow = mx_noise_float(vec3(p.x.mul(14), p.y.mul(2.4).sub(time.mul(0.55)), p.z.mul(14)))
    const rivulet = thread.mul(threadFlow.mul(0.5).add(0.5)).mul(near.mul(0.7).add(0.3))
// The night behind the glass, sampled a hand’s width deeper at every glance.
    const behind = p.sub(view.mul(0.34)).add(lens).add(vec3(0, threadFlow.sub(0.5).mul(0.02), 0))
// Squash the light field along the line of sight, so the city reads as a sheet of lamps behind the
// glass instead of a lattice the eye cuts through edge-on.
    const along = behind.dot(view)
    const sheet = behind.sub(view.mul(along)).add(view.mul(along.mul(0.34)))
    const far = bokeh(sheet, 5.6, 0)
    const nearer = bokeh(sheet.add(vec3(0.13, 0.07, 0.11)), 15, 3.3)
    const haze = mx_noise_float(sheet.mul(1.7)).mul(0.5).add(0.5)
    const lamps = mix(color(hsl.integer(57, 100, 71.7)), color(hsl.integer(236, 100, 75)), far.cold)
    const nearLamps = mix(color(hsl.integer(78, 100, 89)), color(hsl.integer(355, 100, 66.6)), nearer.warm)
// Drizzle speckle and dust on the dry parts, only visible close up.
    const drizzle = filament(mx_noise_float(p.mul(120)).mul(2), 0.08).mul(near)
    const dust = mx_noise_float(p.mul(46)).mul(0.5).add(0.5).mul(near)
    const wet = coarseMask.add(fineMask).add(rivulet).clamp(0, 1)
    const glow = far.disc.mul(0.5).add(nearer.disc.mul(0.24))
    // Each layer carries only its own coverage-weighted tint.
    const glowColor = lamps.mul(far.disc).mul(0.5).add(nearLamps.mul(nearer.disc).mul(0.24))
    this.colorNode = mix(color(hsl.integer(262, 45, 3.3)), color(hsl.integer(261, 44, 8)), facing.oneMinus().mul(0.5))
      .add(glowColor.mul(0.22))
      .add(glowColor.mul(fineMask).mul(0.08))
    this.metalness = 0
    this.roughnessNode = float(0.02).add(drizzle.mul(0.25)).add(dust.mul(0.1)).clamp(0.015, 1)
    this.clearcoatNode = float(0.45).add(wet.mul(0.22)).clamp(0, 0.7)
    this.clearcoatRoughnessNode = float(0.03).add(fineMask.mul(0.12)).add(drizzle.mul(0.2))
    this.ior = 1.5
    this.normalNode = detailNormal(normalViewGeometry, coarseHeight.mul(0.02).add(drizzle.mul(0.0008)).add(rivulet.mul(0.0012)), 0.6)
    this.emissiveNode = glowColor.mul(1)
      .add(color(hsl.integer(59, 100, 74)).mul(haze).mul(0.05))
      .add(nearLamps.mul(nearer.disc).mul(0.7).mul(near.mul(0.6).add(0.4)))
      .add(glowColor.mul(fineMask).mul(0.35))
      .add(color(hsl.integer(255, 100, 90)).mul(rivulet).mul(glow.mul(0.6).add(0.1)).mul(0.35))
      .add(color(hsl.integer(260, 100, 95)).mul(wet).mul(grazing.pow(2)).mul(0.05))
      .add(color(hsl.integer(248, 100, 81.4)).mul(intimate).mul(mx_noise_float(p.mul(6).add(vec3(time.mul(0.1), 0, 0))).mul(0.5).add(0.5)).mul(0.04))
// Drizzle keeps the colour of the lamps it is standing in front of, instead of whitening them.
      .add(mix(glowColor, color(hsl.integer(260, 100, 95)).mul(glow), 0.3).mul(drizzle).mul(0.35))
  }
}
