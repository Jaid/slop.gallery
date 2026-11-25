import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Each cell is a separate pool of vitreous color, divided by a hand-finished gold seam. */
function cloisonne(point: Node<'vec3'>, view: Node<'vec3'>, facing: Node<'float'>, near: Node<'float'>) {
  const domain = point.mul(3.25)
  const warped = domain.add(vec3(mx_noise_float(domain.mul(0.33)), mx_noise_float(domain.mul(0.33).add(11.4)), mx_noise_float(domain.mul(0.33).add(-8.2))).mul(0.24))
  const boundary = cellularBoundary(warped)
  const cell = cellNoiseVec3(warped.floor())
  const seam = boundary.abs().smoothstep(0.012, 0.058).oneMinus()
  const bevel = boundary.abs().smoothstep(0.04, 0.13).oneMinus().sub(seam.mul(0.2))
  const backDomain = point.sub(view.mul(0.085)).mul(3.25)
  const backCell = cellNoiseVec3(backDomain.floor())
  const backBoundary = cellularBoundary(backDomain)
  const backSeam = backBoundary.abs().smoothstep(0.014, 0.07).oneMinus()
  const cellHue = cell.x.mul(0.72).add(cell.y.mul(0.19)).add(cell.z.mul(0.07)).add(facing.mul(0.16))
  const enamel = cosinePalette(cellHue, [0.12, 0.2, 0.3], [0.32, 0.43, 0.48], [1, 1, 1], [0.05, 0.32, 0.62])
  const depthColor = cosinePalette(backCell.x.mul(0.6).add(backCell.y.mul(0.26)).add(facing.mul(0.3)), [0.08, 0.18, 0.28], [0.26, 0.36, 0.44], [1, 1, 1], [0.12, 0.42, 0.68])
  const pool = depthColor.mul(backSeam.oneMinus().mul(0.22)).add(enamel.mul(0.86))
  const glint = cell.z.mul(0.5).add(0.5).pow(7).mul(near)
  return {
    bevel,
    cellHue,
    glint,
    pool,
    seam,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.18)
    this.name = knotData.id
    const {p, view, facing, rim, near, intimate} = viewerFrame()
    const {bevel, cellHue, glint, pool, seam} = cloisonne(p, view, facing, near)
    const dust = mx_fractal_noise_float(p.mul(31).add(time.mul(0.004)), 2, 2.1, 0.5).mul(0.5).add(0.5)
    const micro = mx_noise_float(p.mul(67).add(time.mul(0.006))).mul(0.5).add(0.5)
    const gold = mix(color(hsl.integer(57, 83, 32)), color(hsl.integer(88, 100, 87)), seam.mul(0.75).add(dust.mul(0.25)))
    this.colorNode = mix(pool.mul(0.9), gold, seam.mul(0.9)).add(color(hsl.integer(96, 100, 95)).mul(bevel.mul(0.14)))
    this.metalnessNode = mix(float(0.12), float(0.94), seam).sub(bevel.mul(0.08))
    this.roughnessNode = mix(float(0.16), float(0.065), seam).add(micro.mul(0.045)).add(rim.mul(0.045))
    this.clearcoat = 0.78
    this.clearcoatRoughnessNode = float(0.07).add(seam.mul(0.08))
    this.normalNode = proceduralNormal(seam.mul(0.0032).add(bevel.mul(0.001)).add(micro.mul(0.00025)), 0.0035)
    this.iridescenceNode = seam.oneMinus().mul(0.28).mul(rim.mul(0.5).add(0.18))
    this.iridescenceThicknessNode = facing.mul(360).add(cellHue.mul(240)).add(180)
    this.emissiveNode = pool.mul(glint.mul(0.28).mul(near.mul(0.6).add(0.4))).add(color(hsl.integer(91, 100, 92)).mul(seam.mul(0.16).mul(rim.mul(0.35).add(0.1)))).add(color(hsl.integer(224, 100, 84)).mul(rim.mul(0.075).mul(intimate.mul(0.45).add(0.2))))
  }
}
