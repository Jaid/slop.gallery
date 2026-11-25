import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, positionGeometry, time, vec2, vec3} from 'three/tsl'
import {Color} from 'three/webgpu'

import {bumpNormal} from '../../candidates/claude_sonnet/lib/bumpNormal.ts'
import {tangentViewFrame, tubeGrid} from '../../candidates/claude_sonnet/lib/tubeGrid.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Structural color of a train feather. Staggered eyes sit in a field of hair-fine barbs; the nested rings of each eye are thin-film stacks, so their hues travel outward and inward as the viewpoint changes, and the dark pupil of every eye opens a little as you come near. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.3)
    this.name = knotData.id
    const {near, intimate, grazing, facing} = viewerFrame()
    const p = positionGeometry
    const cells = tubeGrid(6)
    const view = tangentViewFrame()
    const row = cells.grid.y.floor()
    const staggered = vec2(cells.grid.x.add(row.mod(2).mul(0.5)), cells.grid.y)
    const local = staggered.fract().sub(0.5)
    const identity = cellNoiseVec3(vec3(wrapCell(staggered.floor(), vec2(cells.period[0], cells.period[1])), 4.7))
  // Slightly oval eyes, each tilted a little differently.
    const tilt = identity.x.sub(0.5).mul(0.5)
    const rotated = vec2(local.x.mul(tilt.cos()).add(local.y.mul(tilt.sin())), local.y.mul(tilt.cos()).sub(local.x.mul(tilt.sin())))
    const r = rotated.mul(vec2(0.92, 1.28)).length()
    const sway = view.x.mul(0.05).add(view.y.mul(0.045)).add(view.z.mul(0.03))
    const breathe = time.mul(0.45).add(identity.y.mul(6.28)).sin().mul(0.008)
    const draft = mx_noise_float(p.mul(3).add(vec3(time.mul(0.12), 0, 0))).mul(0.012)
    const rr = r.add(sway).add(breathe).add(draft).sub(0.02)
    const rings = [
      {
        edge: 0.085,
        color: hsl.integer(271, 77, 4.6),
      },
      {
        edge: 0.14,
        color: hsl.integer(265, 95.8, 34.6),
      },
      {
        edge: 0.195,
        color: hsl.integer(189, 97.4, 59),
      },
      {
        edge: 0.235,
        color: hsl.integer(144, 96, 49),
      },
      {
        edge: 0.285,
        color: hsl.integer(87, 86, 72),
      },
      {
        edge: 0.345,
        color: hsl.integer(159, 96, 40),
      },
      {
        edge: 0.42,
        color: hsl.integer(172, 85, 21),
      },
    ]
  // `color()` yields a 'color'-typed node; plain vec3 keeps the accumulator type stable.
    const rgb = (hex: number) => {
      const c = new Color(hex)
      return vec3(c.r, c.g, c.b)
    }
    let eye: Node<'vec3'> = rgb(rings[0].color)
    for (const [index, ring] of rings.entries()) {
      if (index === 0) {
        continue
      }
      const prev = rings[index - 1]
      eye = mix(eye, rgb(ring.color), rr.smoothstep(prev.edge, prev.edge + 0.03))
    }
    const eyeMask = rr.smoothstep(0.34, 0.5).oneMinus()
    const ground = mix(color(hsl.integer(163, 77, 15)), color(hsl.integer(85, 76, 26)), mx_noise_float(p.mul(11)).mul(0.5).add(0.5))
  // Hair-fine barbs run diagonally; they modulate brightness and become the anisotropic sheen.
    const barbPhase = cells.grid.x.mul(19).add(cells.grid.y.mul(31)).add(draft.mul(90)).add(time.mul(0.35))
    const barbFootprint = barbPhase.fwidth()
    const barbs = barbPhase.sin().mul(0.5).add(0.5).mul(barbFootprint.smoothstep(0.9, 2.6).oneMinus().mul(0.85).add(0.15))
    const fluff = mx_noise_float(p.mul(60)).mul(near).mul(0.5).add(0.5)
    const glow = eyeMask.mul(rr.smoothstep(0.085, 0.11)).mul(rr.smoothstep(0.24, 0.34).oneMinus())
    this.colorNode = mix(ground, eye, eyeMask).mul(barbs.mul(0.4).add(0.72))
    this.metalnessNode = eyeMask.mul(0.55)
    this.roughnessNode = float(0.34).sub(eyeMask.mul(0.12)).add(barbs.oneMinus().mul(0.1)).sub(near.mul(0.03))
    this.anisotropy = 0.85
    this.anisotropyRotation = Math.PI * 0.5
    this.sheen = 0.25
    this.sheenColor.set(hsl.integer(169, 76, 85.6))
    this.sheenRoughness = 0.35
    this.iridescence = 0.3
    this.iridescenceIOR = 1.7
    this.iridescenceThicknessNode = rr.mul(520).add(170)
    const height = barbs.mul(0.0006).add(fluff.mul(0.0002))
    this.normalNode = bumpNormal(normalViewGeometry.normalize(), height)
    this.emissiveNode = mix(color(hsl.integer(262.6, 100, 47)), color(hsl.integer(165, 98.5, 82)), rr.smoothstep(0.1, 0.24)).mul(glow).mul(intimate.mul(0.2).add(0.1)).mul(facing.mul(0.6).add(0.4))
      .add(color(hsl.integer(170, 100, 90)).mul(grazing.pow(3)).mul(eyeMask.mul(0.05)))
  }
}
