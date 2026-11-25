import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function atlasLine(field: Node<'float'>, width: number) {
  const footprint = field.fwidth().max(0.0001)
  return field.abs().smoothstep(width, footprint.mul(1.2).add(width)).oneMinus()
}
/** A seamless relief map with oceans, contour ink, rivers, weather and inhabited points of light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const continentalWarp = mx_noise_float(p.mul(2.1).add(vec3(4.3, -1.7, 2.8))).mul(0.42)
    const continents = mx_fractal_noise_float(p.mul(4.1).add(continentalWarp), 5, 2.04, 0.52).mul(0.5).add(0.5)
    const highlands = mx_fractal_noise_float(p.mul(13).add(continents.mul(2.3)), 4, 2.16, 0.5).mul(0.5).add(0.5)
    const elevation = continents.mul(0.72).add(highlands.mul(0.28))
    const land = elevation.smoothstep(0.485, 0.545)
    const coast = atlasLine(elevation.sub(0.515), 0.009)
    const mountain = elevation.smoothstep(0.64, 0.84).mul(land)
    const snow = elevation.smoothstep(0.765, 0.91).mul(land)
    const humidity = mx_noise_float(p.mul(7.5).add(vec3(-2.1, 5.8, 1.4))).mul(0.5).add(0.5)
    const forest = humidity.smoothstep(0.54, 0.8).mul(land).mul(snow.oneMinus())
    const desert = humidity.smoothstep(0.22, 0.47).oneMinus().mul(land).mul(mountain.oneMinus())
    const oceanDepth = elevation.smoothstep(0.17, 0.52)
    const ocean = mix(color(hsl.integer(251, 76, 9)), color(hsl.integer(222, 96, 48)), oceanDepth).add(color(hsl.integer(182, 72, 75)).mul(coast.mul(0.22)))
    let terrain = mix(color(hsl.integer(100, 50, 47)), color(hsl.integer(142, 68, 33)), forest.mul(0.85))
    terrain = mix(terrain, color(hsl.integer(72, 60, 61)), desert.mul(0.78))
    terrain = mix(terrain, color(hsl.integer(83, 15, 44)), mountain.mul(0.8))
    terrain = mix(terrain, color(hsl.integer(117, 27, 92)), snow.mul(0.94))
    const contourPhase = elevation.mul(32).fract().sub(0.5)
    const contours = opticalLine(contourPhase, 0.035).mul(land).mul(near)
    const riverField = mx_noise_float(p.mul(11).add(vec3(8.1, -3.7, 4.4))).add(continents.sub(0.5).mul(0.35))
    const rivers = opticalLine(riverField, 0.014).mul(land).mul(elevation.smoothstep(0.5, 0.79)).mul(near.mul(0.7).add(0.3))
    const currentPhase = p.dot(vec3(12, -4, 9)).add(continentalWarp.mul(5)).sub(time.mul(0.4))
    const currents = opticalLine(currentPhase.sin(), 0.055).mul(land.oneMinus()).mul(near).mul(0.45)
// Clouds occupy a shallow layer above the relief and visibly slide against it as viewpoint and time change.
    const cloudPoint = p.sub(view.mul(0.055)).add(vec3(time.mul(0.018), 0, time.mul(-0.012)))
    const cloudCoarse = mx_fractal_noise_float(cloudPoint.mul(6.2), 4, 2.07, 0.52).mul(0.5).add(0.5)
    const cloudFine = mx_noise_float(cloudPoint.mul(24).add(cloudCoarse.mul(2))).mul(0.5).add(0.5)
    const clouds = cloudCoarse.mul(0.78).add(cloudFine.mul(0.22)).smoothstep(0.64, 0.79).mul(near.mul(0.32).add(0.68))
    const cities = cellularPoints(p.sub(view.mul(0.022)).mul(88), 0.018, 0.13, 0.89).mul(land).mul(intimate).mul(clouds.mul(0.7).oneMinus())
    let surface: Node<'vec3'> = mix(ocean, terrain, land)
    surface = mix(surface, color(hsl.integer(134, 15, 18)), contours.mul(0.42))
    surface = mix(surface, color(hsl.integer(218, 67, 80)), rivers.mul(0.8).max(currents.mul(0.45)))
    surface = mix(surface, color(hsl.integer(149, 25, 94)), clouds.mul(0.58))
    this.colorNode = surface
    this.metalness = 0
    this.roughnessNode = mix(float(0.09), float(0.76), land).sub(rivers.mul(0.36)).add(clouds.mul(0.17)).clamp(0.055, 0.95)
    this.clearcoatNode = land.oneMinus().mul(0.92).add(rivers.mul(0.7)).clamp()
    this.clearcoatRoughnessNode = mix(float(0.025), float(0.19), currents.add(clouds).clamp())
    this.sheen = 0.1
    this.sheenColor.set(hsl.integer(155, 47, 82))
    this.sheenRoughness = 0.82
    const geometryRelief = elevation.sub(0.515).max(0).mul(land).mul(0.018).add(mountain.mul(0.009))
    this.positionNode = positionGeometry.add(normalLocal.mul(geometryRelief))
    const shadedRelief = geometryRelief.sub(rivers.mul(0.002)).add(contours.mul(0.0007)).add(highlands.mul(land).mul(0.0018)).add(currents.mul(0.0005))
    this.normalNode = proceduralNormal(shadedRelief, 1)
    const seaSpark = glints(normalViewGeometry, 135).mul(land.oneMinus()).mul(facing.pow(2)).mul(0.52)
    const riverPulse = currentPhase.add(riverField.mul(4)).sin().mul(0.5).add(0.5).pow(10).mul(rivers)
    const cityFlicker = time.mul(2.1).add(highlands.mul(19)).sin().mul(0.22).add(0.78)
    this.emissiveNode = color(hsl.integer(87, 100, 90.4)).mul(cities).mul(cityFlicker).mul(1.8).add(color(hsl.integer(232, 100, 75.8)).mul(riverPulse).mul(0.4)).add(color(hsl.integer(0, 0, 100)).mul(seaSpark)).add(color(hsl.integer(245, 81, 45)).mul(grazing.pow(4)).mul(0.05))
  }
}
