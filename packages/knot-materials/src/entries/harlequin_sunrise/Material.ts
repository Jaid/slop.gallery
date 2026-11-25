import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, positionGeometry, time, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/claude_sonnet/lib/bumpNormal.ts'
import {tangentViewFrame, tubeGrid} from '../../candidates/claude_sonnet/lib/tubeGrid.ts'
import {tubeVoronoi} from '../../candidates/claude_sonnet/lib/tubeVoronoiBorder.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Saturated spectral order of a diffraction lattice: red, amber, green, cyan, violet. */
const opalSpectrum = (phase: Node<'float'>) => {
  const t = phase.mul(Math.PI * 2)
  return vec3(t.cos(), t.sub(2.2).cos(), t.sub(4.1).cos()).mul(0.5).add(0.5).pow(1.6)
}
/** A black opal cut as a harlequin mosaic. Every patch is a stack of silica spheres with its own lattice orientation, so each one sweeps through the spectrum at its own rate as the viewer moves. Approach and a second, finer generation of patches wakes up inside the first. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.35)
    this.name = knotData.id
    const {intimate, near, grazing, facing} = viewerFrame()
    const coarse = tubeGrid(11)
    const fine = tubeGrid(30)
    const voronoiCoarse = tubeVoronoi(coarse.period, 3.1, 0.9)
    const voronoiFine = tubeVoronoi(fine.period, 8.7, 0.9)
    const A = voronoiCoarse(coarse.grid)
    const B = voronoiFine(fine.grid)
    const view = tangentViewFrame()
    const p = positionGeometry
    const footprintA = coarse.grid.fwidth().length()
    const footprintB = fine.grid.fwidth().length()
    const resolvedB = footprintB.smoothstep(0.35, 1.1).oneMinus()
    const detail = near.mul(0.75).add(0.25)
  // Lattice orientation per patch: a random direction in the tangent plane and a random lattice spacing.
    const orient = (id: Node<'vec3'>, scale: number) => {
      const angle = id.x.mul(Math.PI * 2)
      const direction = vec2(angle.cos(), angle.sin())
      return view.x.mul(direction.x).add(view.y.mul(direction.y)).mul(scale).add(view.z.mul(id.y.mul(0.9).add(0.4)))
    }
    const phaseA = orient(A.id, 1.15).add(A.id.z).add(mx_noise_float(p.mul(5).add(time.mul(0.02))).mul(0.06))
    const phaseB = orient(B.id, 1.7).add(B.id.z.mul(3)).add(time.mul(0.012))
  // Some patches burn, some sleep. Sleepers still show a hint of blue-green.
    const fireA = A.id.y.smoothstep(0.08, 0.4).mul(0.92).add(0.08)
    const fireB = B.id.x.smoothstep(0.32, 0.62).mul(resolvedB).mul(detail)
  // Play of color needs light entering the stone: strongest facing the viewer, dimmer toward the girdle.
    const gaze = facing.pow(0.6)
    const seamA = A.edge.smoothstep(0.02, 0.04).mul(footprintA.smoothstep(0.25, 0.9).oneMinus().mul(0.7).add(0.3))
    const seamAWide = A.edge.smoothstep(0.02, 0.1)
    const seamB = B.edge.smoothstep(0.03, 0.09)
    const gradeA = float(1).sub(A.distance.mul(0.6))
    const sparkA = opalSpectrum(phaseA).mul(fireA).mul(seamAWide.mul(0.6).add(0.4)).mul(gradeA)
    const sparkB = opalSpectrum(phaseB).mul(fireB).mul(seamB)
    const spectrum = sparkA.add(sparkB.mul(0.85)).mul(gaze.mul(0.7).add(0.3))
  // Faint milky potch banding under the fire.
    const potch = mx_noise_float(p.mul(9)).mul(0.5).add(0.5)
    const body = mix(color(hsl.integer(275, 28, 4)), color(hsl.integer(268, 40, 12)), potch.mul(0.6).add(grazing.pow(2).mul(0.4)))
    this.colorNode = body.mul(seamA.mul(0.5).add(0.5))
    this.metalness = 0
    this.roughnessNode = float(0.16).add(seamA.oneMinus().mul(0.14)).sub(fireA.mul(0.06))
    this.ior = 1.45
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
    this.iridescence = 0.6
    this.iridescenceIOR = 1.6
    this.iridescenceThicknessNode = A.id.z.mul(320).add(180)
  // Each patch is a very slightly domed cabochon facet.
    const dome = A.distance.mul(A.distance).mul(-0.004).add(seamA.mul(0.0012)).add(B.distance.mul(-0.0006).mul(resolvedB).mul(near))
    this.normalNode = bumpNormal(normalViewGeometry.normalize(), dome)
    const pulse = time.mul(0.5).add(A.id.x.mul(30)).sin().mul(0.12).add(0.88)
    const wake = intimate.mul(0.35).add(0.65)
    this.emissiveNode = spectrum.mul(pulse).mul(wake).mul(0.62).add(color(hsl.integer(284, 79, 27)).mul(grazing.pow(3)).mul(0.05))
  }
}
