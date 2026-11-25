import hsl from 'okhsl'
import {color, float, hash, max, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, sqrt, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {inside, line, visibleDetail, worldNormalToView} from './filters.ts'

const palette = {
  honey: hsl.integer(61, 55, 47),
  umber: hsl.integer(55, 53, 28),
  ring: hsl.integer(60, 53, 16),
  chinking: hsl.integer(85, 24, 62),
  chinkingShadow: hsl.integer(70, 18, 28),
}

/**
 * Hand-hewn log courses with pale chinking, shaded onto flat walls.
 *
 * Each course runs horizontally along whatever wall it is drawn on: a flat adzed face in the middle, rounding off into recessed mortar joints above and below. The rounded shoulders, the adze scallops and the shadowed chinking all come from the world position and the wall’s own normal, so one material dresses every wall, reveal and pier of a room. Relief and fine grain flatten to their average before they could shimmer in the distance.
 */
export default class LogWallMaterial extends MeshStandardNodeMaterial {
  constructor({floorY, pitch = 0.3}: {
    floorY: number
    /** height of one log course including its chinking, in meters */
    pitch?: number
  }) {
    super({
      roughness: 0.78,
      envMapIntensity: 0.2,
    })
    const n = normalWorldGeometry
    const up = vec3(0, 1, 0)
    const vertical = n.y.abs().lessThan(0.5)
    // The horizontal direction along the wall: the logs run this way.
    const tangent = select(vertical, vec3(n.z, 0, n.x.negate()).normalize(), vec3(1, 0, 0))
    const a = positionWorld.dot(tangent).toVar('logAlong')
    const y = positionWorld.y.sub(floorY)
    const course = y.div(pitch).floor().toVar('logCourse')
    const yl = y.div(pitch).fract().sub(0.5).mul(pitch).toVar('logY')
    const offset = 7_340_033
    const random = (stream: number) => hash(course.add(offset + stream * 104_729))
    const footprint = max(a.fwidth(), y.fwidth()).toVar('logFootprint')
    // Logs swell and taper along their length, so neither the hewn face nor the joints run ruler-straight.
    const swell = mx_noise_float(vec3(a.mul(0.32), course.mul(1.7), 2.3))
    const chinkHalf = swell.mul(0.005).add(0.019)
    const flat = mx_noise_float(vec3(a.mul(0.5), course.mul(2.3), 5.1)).mul(0.02).add(random(5).mul(0.04)).add(0.035)
    const shoulder = float(pitch / 2).sub(chinkHalf).sub(flat).max(0.01)
    const q = yl.abs().sub(flat).max(0)
    // Filtered, so the joints neither stair-step up close nor crawl in the distance.
    const onLog = inside(yl.abs().sub(float(pitch / 2).sub(chinkHalf))).toVar('logCoverage')
    const rounding = q.div(shoulder).min(0.985)
    const slope = rounding.div(sqrt(float(1).sub(rounding.mul(rounding)))).min(4)
    // Shallow scallops from the adze across the flat face, each log with its own rhythm.
    const adzePhase = a.div(random(1).mul(0.05).add(0.09)).add(mx_noise_float(vec3(a.mul(3), course, 7.7)).mul(1.5))
    const adze = adzePhase.sin().mul(rounding.oneMinus()).mul(0.09)
    const relief = visibleDetail(footprint, 0.06)
    const fineRelief = visibleDetail(footprint, 0.02)
    const logNormal = n.add(up.mul(yl.sign().mul(slope).mul(relief))).add(tangent.mul(adze.mul(fineRelief)))
    const mortarNormal = n.add(vec3(mx_noise_float(positionWorld.mul(90)), mx_noise_float(positionWorld.mul(90).add(4)), 0).mul(0.25).mul(fineRelief))
    const shading = select(vertical, mix(mortarNormal.normalize(), logNormal.normalize(), onLog), n)
    this.normalNode = worldNormalToView(shading.normalize())
    // Grain: long streaks along the log, a few drying checks on the hewn face.
    const seed = random(2).mul(61)
    const streakPhase = yl.mul(150).add(mx_noise_float(vec3(a.mul(0.6), yl.mul(4), seed)).mul(10))
    const streaks = mix(streakPhase.sin().mul(0.5).add(0.5).pow(4), float(0.2), streakPhase.fwidth().smoothstep(0.8, 2.4))
    const figure = mx_noise_float(vec3(a.mul(0.45), yl.mul(9), seed.add(4))).mul(0.5).add(0.5)
    const pores = mix(mx_noise_float(vec3(a.mul(4), yl.mul(260), seed.add(9))).mul(0.5).add(0.5), float(0.5), yl.mul(260).fwidth().smoothstep(0.6, 2))
    const checkPath = yl.sub(mx_noise_float(vec3(a.mul(0.7), course.mul(3.1), 1.3)).mul(0.05))
    const checkPresence = mx_noise_float(vec3(a.mul(0.9), course.mul(5.3), 8.8)).smoothstep(0.15, 0.45)
    const check = line(checkPath, 0.0018).mul(checkPresence).mul(rounding.oneMinus())
    const tone = random(3).mul(0.4).add(0.75)
    const wood = mix(color(palette.umber), color(palette.honey), figure.mul(0.7).add(random(4).mul(0.3)))
      .mul(tone)
      .mul(pores.mul(0.14).add(0.93))
    const grained = mix(wood, color(palette.ring), streaks.mul(0.3).add(check.mul(0.8)))
    // The rounded shoulders turn away from the light and gather dirt toward the joints.
    const occlusion = float(1).sub(rounding.pow(2).mul(0.38))
    const log = grained.mul(occlusion)
    // Chinking sits back in the joint: shadowed under the log above, lit along its lower lip.
    const mortarDepth = float(pitch / 2).sub(yl.abs()).div(chinkHalf).clamp(0, 1)
    const mortarGrit = mx_noise_float(positionWorld.mul(45)).mul(0.08).add(1)
    const mortarShade = select(yl.greaterThan(0), mortarDepth.mul(0.35).add(0.55), mortarDepth.mul(0.2).add(0.8))
    const mortar = mix(color(palette.chinkingShadow), color(palette.chinking), mortarShade).mul(mortarGrit)
    this.colorNode = select(vertical, mix(mortar, log, onLog), wood)
    this.roughnessNode = mix(float(0.95), pores.mul(0.1).add(streaks.mul(-0.05)).add(0.74), onLog)
  }
}
