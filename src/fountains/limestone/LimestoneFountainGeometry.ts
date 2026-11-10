import type {ProfilePoint} from '#src/lib/gallery/RevolvedProfileGeometry.ts'
import type {Bowl} from './config.ts'
import type {BufferGeometry} from 'three/webgpu'

import {Float32BufferAttribute} from 'three/webgpu'

import RevolvedProfileGeometry from '#src/lib/gallery/RevolvedProfileGeometry.ts'
import {mergeParts} from '#src/lib/geometry.ts'

import fountain, {jetLanding, sheetFlightTime, sheetLanding, sheetPoint} from './config.ts'
import WaterStreamGeometry, {streamWater} from './WaterStreamGeometry.ts'
import WaterVeilGeometry from './WaterVeilGeometry.ts'

const {basinApothem, basinInnerApothem, basinFloor, footApothem, rimTop, bowls, pools, veils, jet, ringJet, ringJets, gravity} = fountain
/**
 * The basin’s cross-section: a pool floor, a vertical inner wall, a bold rim with a rounded outer edge, a cavetto under it and a stepped foot.
 *
 * Every profile runs from the axis outward with the stone on its right, see RevolvedProfileGeometry.
 */
const basin: Array<ProfilePoint> = [
  [0, basinFloor],
  [basinInnerApothem, basinFloor],
  [basinInnerApothem, rimTop - 0.09],
  [basinInnerApothem + 0.012, rimTop - 0.062],
  [basinInnerApothem + 0.038, rimTop - 0.042],
  [basinInnerApothem + 0.09, rimTop - 0.028],
  [basinApothem - 0.03, rimTop - 0.002],
  [basinApothem - 0.008, rimTop - 0.012],
  [basinApothem, rimTop - 0.05],
  [basinApothem - 0.012, rimTop - 0.08],
  [basinApothem - 0.03, rimTop - 0.1],
  [basinApothem - 0.03, rimTop - 0.16],
  [basinApothem - 0.004, rimTop - 0.185],
  [basinApothem - 0.004, rimTop - 0.235],
  [basinApothem - 0.028, rimTop - 0.258],
  [basinApothem - 0.028, rimTop - 0.32],
  [footApothem - 0.075, rimTop - 0.34],
  [footApothem - 0.075, rimTop - 0.44],
  [footApothem - 0.028, rimTop - 0.462],
  [footApothem - 0.028, rimTop - 0.55],
  [footApothem, rimTop - 0.568],
  [footApothem, 0],
]
/** A molded octagonal socle standing on the basin floor, carrying the baluster. */
const socle: Array<ProfilePoint> = [
  [0, 0.62],
  [0.38, 0.62],
  [0.42, 0.6],
  [0.48, 0.6],
  [0.48, 0.56],
  [0.52, 0.54],
  [0.52, 0.44],
  [0.55, 0.42],
  [0.55, 0.37],
  [0.58, 0.35],
  [0.58, basinFloor],
  [0, basinFloor],
]
/** A turned baluster, from the socle up to the underside of the lowest bowl. */
const baluster: Array<ProfilePoint> = [
  [0, 1.3],
  [0.3, 1.3],
  [0.285, 1.26],
  [0.2, 1.2],
  [0.16, 1.14],
  [0.17, 1.08],
  [0.255, 1.02],
  [0.275, 0.97],
  [0.215, 0.91],
  [0.155, 0.86],
  [0.175, 0.8],
  [0.275, 0.74],
  [0.3, 0.68],
  [0.29, 0.64],
  [0.33, 0.62],
  [0.33, 0.58],
  [0, 0.58],
]
/** The stem from the lowest bowl up through its water, with a knop and a waist. */
const middleStem: Array<ProfilePoint> = [
  [0, 2.7],
  [0.19, 2.7],
  [0.175, 2.64],
  [0.13, 2.56],
  [0.11, 2.44],
  [0.1, 2.32],
  [0.12, 2.21],
  [0.165, 2.15],
  [0.175, 2.09],
  [0.13, 2.03],
  [0.11, 1.95],
  [0.1, 1.8],
  [0.12, 1.7],
  [0.165, 1.64],
  [0.175, 1.6],
  [0.2, 1.56],
  [0.24, 1.52],
  [0.26, 1.48],
  [0, 1.48],
]
/** The slender stem from the middle bowl to the cup. */
const upperStem: Array<ProfilePoint> = [
  [0, 3.78],
  [0.155, 3.78],
  [0.145, 3.72],
  [0.1, 3.64],
  [0.085, 3.52],
  [0.08, 3.4],
  [0.095, 3.3],
  [0.13, 3.24],
  [0.14, 3.18],
  [0.1, 3.12],
  [0.085, 3.04],
  [0.08, 2.94],
  [0.11, 2.9],
  [0.14, 2.88],
  [0, 2.88],
]
/** A shallow bowl: a gently rising inside, a bold lip with a bead under it, and an underside sweeping in to the stem. */
function bowlProfile({floor, lip, rim, under}: Bowl): Array<ProfilePoint> {
  const depth = rim - floor
  const shell = rim - under
  return [
    [0, floor],
    [lip * 0.3, floor + 0.006],
    [lip * 0.56, floor + 0.028],
    [lip * 0.75, floor + depth * 0.3],
    [lip * 0.89, floor + depth * 0.63],
    [lip * 0.95, rim - 0.042],
    [lip * 0.985, rim - 0.014],
    [lip, rim],
    [lip * 0.999, rim - 0.012],
    [lip * 0.978, rim - 0.026],
    [lip * 0.948, rim - 0.031],
    [lip * 0.942, rim - 0.05],
    [lip * 0.916, rim - 0.062],
    [lip * 0.925, rim - 0.082],
    [lip * 0.9, rim - 0.1],
    [lip * 0.93, rim - shell * 0.16],
    [lip * 0.82, rim - shell * 0.36],
    [lip * 0.66, rim - shell * 0.58],
    [lip * 0.48, rim - shell * 0.78],
    [lip * 0.33, rim - shell * 0.94],
    [lip * 0.2, under],
  ]
}
/** A turned gilt nozzle standing on the basin floor, its mouth just above the water. */
const nozzle: Array<ProfilePoint> = [
  [0, ringJet.y - 0.005],
  [0.024, ringJet.y - 0.006],
  [0.03, ringJet.y - 0.024],
  [0.044, ringJet.y - 0.04],
  [0.05, ringJet.y - 0.07],
  [0.08, ringJet.y - 0.1],
  [0.08, basinFloor],
  [0, basinFloor],
]
/** The gilt finial in the cup, whose mouth the tall jet leaves. */
const finial: Array<ProfilePoint> = [
  [0, jet.y],
  [0.022, jet.y - 0.002],
  [0.03, jet.y - 0.02],
  [0.058, jet.y - 0.055],
  [0.062, jet.y - 0.085],
  [0.045, jet.y - 0.11],
  [0.04, jet.y - 0.16],
  [0.07, jet.y - 0.22],
  [0.085, jet.y - 0.26],
  [0.085, bowls.cup.floor],
  [0, bowls.cup.floor],
]
/** A gilt inlay band laid into the basin’s rim, `proud` above the stone. */
function inlay(inner: number, outer: number, y: number, proud: number): Array<ProfilePoint> {
  return [
    [inner, y],
    [inner, y + proud],
    [outer, y + proud],
    [outer, y],
  ]
}
/**
 * UV u wraps around the axis and v is the water’s age in seconds.
 * `waterFall` is the fraction of a fall already behind it, which tears the sheet apart; `waterAir` is how much air the water has taken in, which turns it white.
 */
function waterPart(geometry: BufferGeometry, duration: number, air: (fall: number) => number) {
  const uv = geometry.getAttribute('uv')
  const fall = new Float32Array(uv.count)
  const airTaken = new Float32Array(uv.count)
  const dense = new Float32Array(uv.count)
  for (let i = 0; i < uv.count; i++) {
    const progress = uv.getY(i) / duration
    fall[i] = progress
    airTaken[i] = air(progress)
  }
  geometry.setAttribute('waterFall', new Float32BufferAttribute(fall, 1))
  geometry.setAttribute('waterAir', new Float32BufferAttribute(airTaken, 1))
  geometry.setAttribute('waterDense', new Float32BufferAttribute(dense, 1))
  return geometry
}
/** The sheet that pours over a bowl’s lip, breaking into tongues as it falls, drawn from the pool’s surface down to the pool below. */
function veil(sheet: {
  outward: number
  radius: number
  until: number
  y: number
}, {lobeDepth, lobes, samples, sides}: {
  lobeDepth: number
  lobes: number
  samples: number
  sides: number
}) {
  const duration = sheetFlightTime(sheet)
  const geometry = new WaterVeilGeometry({
    radius: age => sheetPoint(sheet, age)[0],
    y: age => sheetPoint(sheet, age)[1],
  }, {
    duration,
    lobeDepth,
    lobes,
    samples,
    sides,
  })
  return waterPart(geometry, duration, fall => 0.1 + fall ** 2 * 0.62)
}
/** Speed of a ballistic stream, which sets how much its cross-section narrows and swells. */
function streamSpeed(horizontal: number, vertical: number, age: number) {
  return Math.hypot(horizontal, vertical - gravity * age)
}
/**
 * One of the ring jets, drawn up to its apex: it thins where it leaves the nozzle, swells as it slows and lets go into droplets at the top, which the spray carries on from there.
 */
function ringJetStream(sides: number, samples: number) {
  const mouth = 0.017
  const duration = ringJet.rise / gravity
  const start = streamSpeed(ringJet.outward, ringJet.rise, 0)
  const geometry = new WaterStreamGeometry({
    radius: age => ringJet.radius + ringJet.outward * age,
    y: age => ringJet.y + ringJet.rise * age - gravity / 2 * age ** 2,
    thickness: age => {
      // Continuity, capped where the jet would swell without bound as it stalls.
      const swell = Math.min(2.4, Math.sqrt(start / streamSpeed(ringJet.outward, ringJet.rise, age)))
      const necking = 1 + 0.06 * Math.sin(age * 54 + 1.3)
      // The last fifth lets go into droplets.
      const breakup = 1 - 0.95 * Math.min(1, Math.max(0, (age / duration - 0.62) / 0.38)) ** 1.4
      return mouth * swell * necking * breakup
    },
  }, {
    duration,
    samples,
    sides,
  })
  return streamWater(geometry, fall => 0.1 + fall ** 1.4 * 0.55 + fall ** 6 * 0.2)
}
/** The tall central jet: a column that narrows with height by continuity and closes into a crown below its apex. */
function centralJet(sides: number, samples: number) {
  const rise = jet.speed ** 2 / (2 * gravity)
  const duration = (jet.speed - Math.sqrt(jet.speed ** 2 - 2 * gravity * rise * jet.solid)) / gravity
  const geometry = new WaterStreamGeometry({
    radius: () => 0,
    y: age => jet.y + jet.speed * age - gravity / 2 * age ** 2,
    thickness: age => {
      const swell = Math.sqrt(jet.speed / streamSpeed(0, jet.speed, age))
      const crown = age / duration
      // The column closes into a rounded, aerated crown just before the droplets take over.
      const tip = crown > 0.8 ? Math.sqrt(Math.max(0, 1 - ((crown - 0.8) / 0.2) ** 2)) : 1
      return jet.radius * swell * (0.35 + 0.65 * tip)
    },
  }, {
    duration,
    samples,
    sides,
  })
  return streamWater(geometry, fall => 0.3 + fall * 0.45)
}
/** A water surface with the same polygon corners as RevolvedProfileGeometry, `apothem` measured like its profiles. */
function pool(apothem: number, sides: number, y: number, splash: readonly [number, number], foam: readonly [number, number]) {
  const geometry = new RevolvedProfileGeometry([[0, y], [apothem, y]], {sides})
  const count = geometry.getAttribute('position').count
  const constant = (value: number) => {
    const values = new Float32Array(count)
    values.fill(value)
    return new Float32BufferAttribute(values, 1)
  }
  geometry.setAttribute('splashA', constant(splash[0]))
  geometry.setAttribute('splashB', constant(splash[1]))
  geometry.setAttribute('foamA', constant(foam[0]))
  geometry.setAttribute('foamB', constant(foam[1]))
  return geometry
}

/**
 * The limestone fountain, merged by material: a carved octagonal basin on a stepped foot, a baluster carrying three brimming bowls, their overflowing veils, eight ring jets and the tall central jet, plus the water surface of every pool.
 *
 * The gilt parts are the ring jets’ nozzles, the finial in the cup and an inlay band along the basin’s rim.
 */
export default class LimestoneFountainGeometry {
  readonly gilt: BufferGeometry
  readonly pools: BufferGeometry
  readonly stone: BufferGeometry
  readonly water: BufferGeometry

  constructor() {
    this.stone = mergeParts([
      new RevolvedProfileGeometry(basin, {sides: 8}),
      new RevolvedProfileGeometry(socle, {sides: 8}),
      new RevolvedProfileGeometry(baluster, {sides: 24}),
      new RevolvedProfileGeometry(middleStem, {sides: 20}),
      new RevolvedProfileGeometry(upperStem, {sides: 16}),
      new RevolvedProfileGeometry(bowlProfile(bowls.lower), {sides: 48}),
      new RevolvedProfileGeometry(bowlProfile(bowls.middle), {sides: 40}),
      new RevolvedProfileGeometry(bowlProfile(bowls.cup), {sides: 32}),
    ])
    this.gilt = mergeParts([
      // One turned nozzle per ring jet, standing on the basin floor.
      ...Array.from({length: ringJets}, (_, index) => {
        const spout = new RevolvedProfileGeometry(nozzle, {sides: 16})
        return spout.translate(ringJet.radius, 0, 0).rotateY(index * Math.PI * 2 / ringJets)
      }),
      new RevolvedProfileGeometry(finial, {sides: 14}),
      // A band laid into the rim between the water and the outer edge.
      new RevolvedProfileGeometry(inlay(basinApothem - 0.135, basinApothem - 0.075, rimTop + 0.001, 0.004), {sides: 8}),
    ])
    this.pools = mergeParts([
      // The basin surface tucks into the stone wall; the bowls brim a little over their lips.
      pool(fountain.basinPoolRadius, 8, pools.basin, [sheetLanding(veils.lower), jetLanding(ringJet)], [1, 0.85]),
      pool(veils.lower.radius, 48, pools.lower, [sheetLanding(veils.middle), sheetLanding(veils.middle)], [0.9, 0]),
      pool(veils.middle.radius, 40, pools.middle, [sheetLanding(veils.cup), sheetLanding(veils.cup)], [0.8, 0]),
      pool(veils.cup.radius, 32, pools.cup, [0.09, 0.09], [0.45, 0]),
    ])
    this.water = mergeParts([
      veil(veils.lower, {
        lobeDepth: 0.05,
        lobes: 12,
        samples: 12,
        sides: 96,
      }),
      veil(veils.middle, {
        lobeDepth: 0.055,
        lobes: 10,
        samples: 10,
        sides: 80,
      }),
      veil(veils.cup, {
        lobeDepth: 0.06,
        lobes: 8,
        samples: 8,
        sides: 64,
      }),
      ...Array.from({length: ringJets}, (_, index) => ringJetStream(8, 24).rotateY(index * Math.PI * 2 / ringJets)),
      centralJet(10, 14),
    ])
  }

  dispose() {
    this.stone.dispose()
    this.gilt.dispose()
    this.pools.dispose()
    this.water.dispose()
  }
}
