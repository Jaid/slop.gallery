import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_worley_noise_vec3, time, uv, vec2, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function opalCells(point: Node<'vec3'>, scale: number, seed: number) {
  const domain = point.mul(scale).add(vec3(seed, seed * 0.53, seed * -0.37))
  const warp = mx_fractal_noise_float(domain.mul(0.19), 2, 2.1, 0.5).mul(scale * 0.11)
  const cells = mx_worley_noise_vec3(domain.add(warp), 1, 0)
  return {
    center: cells.x.smoothstep(0.025, 0.2).oneMinus(),
    edge: cells.y.sub(cells.x),
  }
}
function flake(point: Node<'vec2'>, phase: Node<'float'>, footprint: Node<'float'>) {
  const q = point.mul(vec2(7, 23)).add(vec2(phase.mul(0.15), phase.mul(-0.11)))
  const cell = q.floor()
  const local = q.fract().sub(0.5)
  const randomPhase = cell.x.mul(17.13).add(cell.y.mul(9.71)).sin().mul(43_758.55).fract()
  const radius = randomPhase.mul(0.14).add(0.25)
  const flakeMask = local.length().smoothstep(radius, radius.add(footprint.mul(1.4))).oneMinus()
  const resolved = footprint.smoothstep(0.05, 0.3).oneMinus()
  return {
    flake: flakeMask.mul(resolved),
    randomPhase,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const {p, view, facing, rim, near, intimate} = viewerFrame()
    const cellsA = opalCells(p, 5.2, 0.8)
    const cellsB = opalCells(p.sub(view.mul(0.045)), 11.7, 7.1)
    const cellsC = opalCells(p.sub(view.mul(0.085)), 23.5, 13.9)
    const field = mx_fractal_noise_float(p.mul(2.7).add(vec3(time.mul(0.009), 0, time.mul(-0.006))), 3, 2.08, 0.53)
    const broadFire = spectralColor(field.mul(1.4).add(facing.mul(1.9)).add(view.x.mul(0.28)))
    const cellFire = spectralColor(cellsA.center.mul(0.76).add(cellsB.center.mul(0.47)).add(field.mul(0.33)).add(facing.mul(2.2)).add(time.mul(0.004)))
    const fire = mix(broadFire, cellFire, cellsA.center.mul(0.6).add(cellsB.center.mul(0.24)))
    const milk = mix(color(hsl.integer(234, 17, 80)), color(hsl.integer(90, 32, 94)), field.mul(0.5).add(0.5)).mul(0.72)
    const inclusion = flake(uv(), field, cellsC.edge.abs().mul(0.08).add(uv().fwidth().length().mul(7.2)))
    const darkInclusion = flake(uv().mul(vec2(1.17, 0.83)).add(3.1), field.negate(), uv().fwidth().length().mul(9.5))
    const inclusions = inclusion.flake.mul(0.48).add(darkInclusion.flake.mul(0.26)).mul(intimate.mul(0.6).add(0.4))
    const shell = mix(milk, fire.mul(0.9), cellsA.center.mul(0.68).add(cellsB.center.mul(0.3)).add(field.mul(0.1)))
    this.colorNode = mix(shell, color(hsl.integer(87, 100, 97.4)), inclusions.mul(0.72))
    this.metalness = 0.12
    this.roughnessNode = float(0.11).add(cellsC.edge.abs().mul(0.12)).add(inclusions.mul(0.08))
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.025).add(inclusions.mul(0.05))
    this.iridescence = 0.88
    this.iridescenceIOR = 1.38
    this.iridescenceThicknessNode = facing.mul(560).add(cellsA.center.mul(320)).add(cellsB.center.mul(190)).add(220)
    this.normalNode = proceduralNormal(cellsA.center.mul(0.0012).add(cellsC.center.mul(0.00045)).add(field.mul(0.00035)), 0.0022)
    this.emissiveNode = fire.mul(cellsA.center.mul(0.5).add(cellsB.center.mul(0.22)).mul(near.mul(0.3).add(0.7)).mul(0.48)).add(color(hsl.integer(89, 100, 97)).mul(inclusions.mul(0.46)).add(color(hsl.integer(219, 100, 91)).mul(rim.mul(0.11))))
  }
}
