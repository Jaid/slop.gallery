import type {Hull, MeshBuilder} from './meshBuilder.ts'

import {CatmullRomCurve3, Vector3} from 'three/webgpu'

import {sahurPose} from './config.ts'
import {clamp, gaussian, lerp, makeHull, smoothstep, sweepTube, tau} from './meshBuilder.ts'

/** Builds both arms, hands, seamless legs + low-heeled bare feet and the chunky baseball bat, returning all physics hulls. */
export function buildLimbsAndBat(mesh: MeshBuilder): Array<Hull> {
  const hulls: Array<Hull> = []
  for (const side of [-1, 1] as const) {
    hulls.push(...buildArm(mesh, side))
    hulls.push(...buildLegAndFoot(mesh, side))
  }
  hulls.push(...buildBat(mesh))
  return hulls
}

/** Samples N+1 evenly spaced points along a Catmull-Rom curve. */
function sampleCurve(points: ReadonlyArray<readonly [number, number, number]>, steps: number) {
  const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)))
  return Array.from({length: steps + 1}, (_, i) => curve.getPointAt(i / steps))
}
/** Builds a plump, blunt-tipped articulated finger or thumb with subtle knuckle swells and a rounded fingertip dome. */
function addFinger(
  mesh: MeshBuilder,
  points: ReadonlyArray<readonly [number, number, number]>,
  baseRadius: number,
  tipRadius: number,
  sides = 8,
  steps = 8,
) {
  const spine = sampleCurve(points, steps)
  const rings = sweepTube(spine, sides, t => {
    let r = lerp(baseRadius, tipRadius, smoothstep(0, 0.86, t))
    r *= 1 + 0.08 * gaussian(t - 0.36, 0.08) + 0.07 * gaussian(t - 0.68, 0.07)
    // Plump blunt hemispherical fingertip (no sharp claw taper).
    if (t > 0.86) {
      const u = (t - 0.86) / 0.14
      r *= Math.max(0.32, Math.sqrt(Math.max(0, 1 - u * u)))
    }
    return [r * 0.94, r] as const
  }, new Vector3(0, 0, 1))
  const tipDir = spine.at(-1)!.clone().sub(spine.at(-2)!).normalize()
  const tipCap = spine.at(-1)!.clone().addScaledVector(tipDir, tipRadius * 0.52)
  return mesh.addClosedLoft(rings, spine[0], tipCap)
}
/** Builds a slightly forward-set rounded shoulder nub, articulated elbow bend, slender forearm and plump 5-finger hand. */
function buildArm(mesh: MeshBuilder, side: -1 | 1): Array<Hull> {
  const {bodyRx, cx, cz, shoulderY} = sahurPose
  // Slightly forward-set rounded deltoid nub flush on the log side, straight upper arm to crisp elbow bend, inward-angled forearm.
  const sx = cx + side * (bodyRx - 0.02)
  const elbowX = cx + side * (bodyRx + 0.095)
  const shoulderZ = cz + 0.02
  let wrist: readonly [number, number, number]
  let armPoints: Array<readonly [number, number, number]>
  if (side === 1) {
    // Character's left arm (viewer's right): crisp outward elbow bend then forearm angling clearly inward across lower-right front edge.
    wrist = [cx + bodyRx + 0.018, 1.6, cz + 0.185]
    armPoints = [
      [sx - side * 0.025, shoulderY + 0.018, shoulderZ],
      [sx + side * 0.03, shoulderY - 0.032, shoulderZ + 0.005],
      [lerp(sx + 0.03, elbowX, 0.55), 2.11, shoulderZ - 0.005],
      [elbowX, 1.9, shoulderZ - 0.015],
      [lerp(elbowX, wrist[0], 0.48), 1.75, cz + 0.095],
      wrist,
    ]
  } else {
    // Character's right arm (viewer's left): crisp elbow bend then inward forearm to grip the chunky bat handle below its visible pommel butt.
    const knob = new Vector3(...sahurPose.batKnob)
    const tip = new Vector3(...sahurPose.batTip)
    const grip = knob.clone().lerp(tip, 0.125)
    wrist = [grip.x - 0.038, grip.y + 0.095, grip.z + 0.01]
    armPoints = [
      [sx - side * 0.025, shoulderY + 0.018, shoulderZ],
      [sx + side * 0.03, shoulderY - 0.032, shoulderZ - 0.005],
      [lerp(sx - 0.03, elbowX, 0.55), 2.11, shoulderZ - 0.02],
      [elbowX, 1.9, shoulderZ - 0.04],
      [lerp(elbowX, wrist[0], 0.5), 1.74, cz - 0.02],
      wrist,
    ]
  }
  const spine = sampleCurve(armPoints, 24)
  const rings = sweepTube(spine, 14, t => {
    const deltoid = 0.022 * gaussian(t - 0.08, 0.055)
    const elbowJoint = 0.007 * gaussian(t - 0.54, 0.065)
    const r = lerp(0.052, 0.037, smoothstep(0.08, 0.96, t)) + deltoid + elbowJoint
    return [r, r * 0.96] as const
  }, new Vector3(0, 0, 1))
  const armVol = mesh.addClosedLoft(rings, spine[0], spine.at(-1))
  let palmVol = 0
  let palmRings: Array<Array<Vector3>> = []
  if (side === 1) {
    // Open left hand (viewer's right): starts smoothly overlapping up into the forearm (zero wrist seam), fuller rounded palm, distinct higher-set thumb, plump blunt-tipped fingers.
    const [px0, py0, pz0] = wrist
    const palmSpine = sampleCurve([
      [px0 + 0.014, py0 + 0.055, pz0 - 0.034],
      [px0, py0, pz0],
      [px0 - 0.032, py0 - 0.062, pz0 + 0.048],
      [px0 - 0.072, py0 - 0.125, pz0 + 0.085],
    ], 9)
    const palmRef = new Vector3(1, 0.1, 0.55)
    palmRef.normalize()
    palmRings = sweepTube(palmSpine, 12, t => {
      const palmT = smoothstep(0.24, 0.85, t)
      const w = lerp(0.036, 0.068, palmT) * (t > 0.86 ? lerp(1, 0.84, (t - 0.86) / 0.14) : 1)
      const thick = lerp(0.036, 0.029, palmT)
      return [thick, w] as const
    }, palmRef)
    palmVol = mesh.addClosedLoft(palmRings, palmSpine[0], palmSpine.at(-1))
    // Higher-set plump thumb curving gently inward across the front of the log.
    palmVol += addFinger(mesh, [
      [px0 - 0.024, py0 - 0.032, pz0 + 0.046],
      [px0 - 0.086, py0 - 0.026, pz0 + 0.098],
      [px0 - 0.142, py0 - 0.044, pz0 + 0.124],
    ], 0.022, 0.0185, 8, 7)
    // Four plump blunt-tipped fingers curling softly inward toward the lower-right torso corner.
    const fingerSpecs = [
      {
        dX: -0.008,
        dY: 0.018,
        dZ: 0.042,
        len: 0.122,
        r0: 0.0185,
        r1: 0.0155,
        curlX: -0.072,
      },
      {
        dX: -0.004,
        dY: 0,
        dZ: 0.014,
        len: 0.132,
        r0: 0.019,
        r1: 0.016,
        curlX: -0.078,
      },
      {
        dX: 0.004,
        dY: -0.015,
        dZ: -0.015,
        len: 0.12,
        r0: 0.018,
        r1: 0.015,
        curlX: -0.068,
      },
      {
        dX: 0.012,
        dY: -0.028,
        dZ: -0.041,
        len: 0.098,
        r0: 0.0165,
        r1: 0.014,
        curlX: -0.055,
      },
    ]
    const knX = px0 - 0.072
    const knY = py0 - 0.122
    const knZ = pz0 + 0.084
    for (const f of fingerSpecs) {
      const bx = knX + f.dX
      const by = knY + f.dY
      const bz = knZ + f.dZ
      palmVol += addFinger(mesh, [
        [bx, by, bz],
        [bx + f.curlX * 0.45, by - f.len * 0.52, bz + 0.016],
        [bx + f.curlX, by - f.len * 0.88, bz - 0.006],
      ], f.r0, f.r1)
    }
  } else {
    // Articulated right hand (viewer's left): distinct palm, thumb-over-index wrap and 4 plump fingers gripping below the visible bat butt.
    const knob = new Vector3(...sahurPose.batKnob)
    const tip = new Vector3(...sahurPose.batTip)
    const batDir = tip.clone().sub(knob).normalize()
    const grip = knob.clone().lerp(tip, 0.125)
    const outX = new Vector3(-1, 0, 0)
    const sideFwd = outX.clone().cross(batDir).normalize()
    const gripOut = batDir.clone().cross(sideFwd).normalize()
    const palmSpine = sampleCurve([
      [wrist[0], wrist[1] + 0.012, wrist[2]],
      [grip.x - 0.056, grip.y + 0.022, grip.z - 0.01],
      [grip.x - 0.058, grip.y - 0.058, grip.z + 0.018],
    ], 8)
    palmRings = sweepTube(palmSpine, 12, t => {
      const w = lerp(0.038, 0.066, Math.sin(Math.PI * clamp(t * 0.85 + 0.12, 0.05, 0.95)))
      const thick = lerp(0.034, 0.029, t)
      return [thick, w] as const
    }, new Vector3(1, 0, 0))
    palmVol = mesh.addClosedLoft(palmRings, palmSpine[0], palmSpine.at(-1))
    const pWrap = (s: number, ang: number, rad: number) => grip.clone()
      .addScaledVector(batDir, s)
      .addScaledVector(gripOut, rad * Math.cos(ang))
      .addScaledVector(sideFwd, rad * Math.sin(ang))
      .toArray() as readonly [number, number, number]
    // Four plump fingers curling firmly around the thick bat grip.
    const gripSlots = [-0.044, -0.014, 0.016, 0.045]
    const gripRadii = [0.0185, 0.019, 0.018, 0.0165]
    for (let i = 0; i < 4; i++) {
      const s = gripSlots[i]
      palmVol += addFinger(mesh, [
        pWrap(s, 0.05, 0.062),
        pWrap(s, 1.15, 0.059),
        pWrap(s, 2.3, 0.055),
        pWrap(s, 3.2, 0.052),
      ], gripRadii[i], gripRadii[i] * 0.86)
    }
    // Plump thumb wrapping clearly OVER the index finger across the front of the bat handle.
    palmVol += addFinger(mesh, [
      [grip.x - 0.048, grip.y + 0.05, grip.z + 0.026],
      pWrap(-0.048, 1.15, 0.072),
      pWrap(-0.028, 2.15, 0.068),
    ], 0.022, 0.0185, 8, 7)
  }
  const mid = Math.floor(rings.length / 2)
  const upperPts: Array<Vector3> = []
  for (const r of [0, Math.floor(mid / 2), mid]) {
    for (let j = 0; j < rings[r].length; j += 2) {
      upperPts.push(rings[r][j])
    }
  }
  const lowerPts: Array<Vector3> = []
  for (const r of [mid, Math.floor((mid + rings.length - 1) / 2), rings.length - 1]) {
    for (let j = 0; j < rings[r].length; j += 2) {
      lowerPts.push(rings[r][j])
    }
  }
  for (const ring of [palmRings[0], palmRings.at(-1)!]) {
    for (let j = 0; j < ring.length; j += 3) {
      lowerPts.push(ring[j])
    }
  }
  return [
    makeHull(upperPts, armVol * 0.5),
    makeHull(lowerPts, armVol * 0.5 + palmVol),
  ]
}
/**
 * Builds one seamless, continuous Leg -> Pronounced Kneecap -> Upper Calf -> Bony Ankle -> Low Flat-Planted Heel & Arched Foot + 5 Plump Nestled Toes with Broad Carved Toenails.
 */
function buildLegAndFoot(mesh: MeshBuilder, side: -1 | 1): Array<Hull> {
  const {bodyBottomY, cx, cz, hipOffsetX} = sahurPose
  const hx = cx + side * hipOffsetX
  const ax = cx + side * (hipOffsetX + 0.012)
  const az = cz - 0.025
  const footYaw = side === -1 ? -0.94 : 0.17
  const cosFoot = Math.cos(footYaw)
  const sinFoot = Math.sin(footYaw)
  const footToWorld = (lx: number, ly: number, lz: number) => {
    const mx = lx * side
    return new Vector3(
      ax + mx * cosFoot + lz * sinFoot,
      Math.max(0, ly),
      az - mx * sinFoot + lz * cosFoot,
    )
  }
  const crossSides = 24
  const rings: Array<Array<Vector3>> = []
  const yTop = bodyBottomY + 0.05
  // Section A: Anatomically sculpted leg from fuller upper thigh -> clear patella kneecap -> upper calf swell -> slender bony ankle (y = 1.47 -> 0.28).
  const legSteps = 20
  for (let i = 0; i <= legSteps; i++) {
    const t = i / legSteps
    const y = lerp(yTop, 0.28, t)
    const centerX = lerp(hx, ax, t) + side * 0.008 * Math.sin(Math.PI * t)
    const yaw = footYaw * smoothstep(0.68, 0.28, y)
    const cy = Math.cos(yaw)
    const sy = Math.sin(yaw)
    const thighFull = smoothstep(1.08, 1.44, y)
    const kneeFactor = gaussian(y - 0.96, 0.068)
    const upperCalf = gaussian(y - 0.72, 0.115)
    const ankleNarrow = gaussian(y - 0.34, 0.07)
    const malleolus = gaussian(y - 0.29, 0.032)
    const baseR = lerp(0.088, 0.054, smoothstep(0.02, 0.92, t)) + 0.014 * thighFull - 0.005 * ankleNarrow
    const ring: Array<Vector3> = []
    for (let j = 0; j < crossSides; j++) {
      const angle = tau * j / crossSides
      const cosA = Math.cos(angle) // +1 = front (+Z), -1 = back (-Z)
      const sinA = Math.sin(angle) // +1 = lateral (+X), -1 = medial (-X)
      const front = Math.max(0, cosA)
      const back = Math.max(0, -cosA)
      const rSide = baseR * (1 + 0.16 * kneeFactor + 0.14 * upperCalf) + 0.009 * malleolus * Math.abs(sinA) ** 1.5
      let rFrontBack = baseR * (1.03 + 0.08 * upperCalf)
      // Pronounced forward rounded patella kneecap + subtle hollow behind knee.
      let zOff = 0.038 * kneeFactor * front ** 1.7 - 0.018 * kneeFactor * back
      // Clean upper-calf swell posteriorly tapering neatly into the Achilles tendon.
      zOff -= 0.025 * upperCalf * back ** 1.6
      // Subtle anterior shin crest.
      rFrontBack += 0.006 * smoothstep(0.38, 0.85, t) * front ** 2
      const lx = rSide * sinA * side
      const lz = rFrontBack * cosA + zOff
      ring.push(new Vector3(
        centerX + lx * cy + lz * sy,
        y,
        az - lx * sy + lz * cy,
      ))
    }
    rings.push(ring)
  }
  // Section B: Anatomical Achilles tendon -> compact low-planted flat heel (y = 0) -> smooth instep bend (ZERO swollen heel bulb or underside V-pinch!).
  const bendStations: Array<{
    arch: number
    centerX: number
    flatSole: number
    rx: number
    yBot: number
    yTop: number
    zBot: number
    zTop: number
  }> = [
    {
      zTop: 0.06,
      yTop: 0.238,
      zBot: -0.062,
      yBot: 0.222,
      rx: 0.056,
      centerX: 0,
      arch: 0,
      flatSole: 0,
    },
    {
      zTop: 0.072,
      yTop: 0.202,
      zBot: -0.076,
      yBot: 0.162,
      rx: 0.06,
      centerX: 0.001,
      arch: 0,
      flatSole: 0,
    },
    {
      zTop: 0.088,
      yTop: 0.176,
      zBot: -0.114,
      yBot: 0.104,
      rx: 0.07,
      centerX: 0.002,
      arch: 0,
      flatSole: 0,
    },
    {
      zTop: 0.106,
      yTop: 0.16,
      zBot: -0.152,
      yBot: 0.052,
      rx: 0.082,
      centerX: 0.003,
      arch: 0,
      flatSole: 0.2,
    },
    {
      zTop: 0.122,
      yTop: 0.15,
      zBot: -0.146,
      yBot: 0,
      rx: 0.088,
      centerX: 0.004,
      arch: 0,
      flatSole: 0.85,
    },
    {
      zTop: 0.136,
      yTop: 0.144,
      zBot: -0.095,
      yBot: 0,
      rx: 0.093,
      centerX: 0.005,
      arch: 0,
      flatSole: 1,
    },
    {
      zTop: 0.148,
      yTop: 0.14,
      zBot: -0.01,
      yBot: 0,
      rx: 0.098,
      centerX: 0.006,
      arch: 0.008,
      flatSole: 1,
    },
    {
      zTop: 0.158,
      yTop: 0.136,
      zBot: 0.08,
      yBot: 0,
      rx: 0.106,
      centerX: 0.008,
      arch: 0.016,
      flatSole: 1,
    },
    {
      zTop: 0.168,
      yTop: 0.132,
      zBot: 0.168,
      yBot: 0,
      rx: 0.116,
      centerX: 0.01,
      arch: 0.02,
      flatSole: 1,
    },
  ]
  for (const st of bendStations) {
    const zMid = (st.zTop + st.zBot) / 2
    const yMid = (st.yTop + st.yBot) / 2
    const dz = (st.zTop - st.zBot) / 2
    const dy = (st.yTop - st.yBot) / 2
    const ring: Array<Vector3> = []
    for (let j = 0; j < crossSides; j++) {
      const angle = tau * j / crossSides
      const cosA = Math.cos(angle)
      const sinA = Math.sin(angle)
      // Gentle inward medial waist hollow along the inner midfoot arch.
      const medialHollow = st.arch > 0 && sinA < 0 ? 1 - 0.14 * smoothstep(0, 0.02, st.arch) * -sinA : 1
      const lx = st.centerX + st.rx * medialHollow * Math.sign(sinA) * Math.abs(sinA) ** 0.88
      const lz = zMid + dz * cosA
      let ly: number
      if (cosA >= 0) {
        ly = yMid + dy * cosA ** 0.82
      } else {
        const roundedY = Math.max(0, yMid + dy * cosA)
        const medialMask = smoothstep(0.1, -0.75, sinA)
        const flatY = (1 - Math.abs(cosA)) ** 2 * 0.018 + st.arch * medialMask * (1 + 0.45 * cosA)
        ly = Math.max(0, lerp(roundedY, flatY, st.flatSole))
      }
      ring.push(footToWorld(lx, ly, lz))
    }
    rings.push(ring)
  }
  // Section C: Sleek broad forefoot with dorsal extensor tendon ridges and smooth toe-root transition (z = 0.168 -> 0.48).
  const footSteps = 10
  const zMidStart = 0.168
  const zBall = 0.47
  for (let i = 1; i <= footSteps; i++) {
    const t = i / footSteps
    const z = lerp(zMidStart, zBall, t)
    const frontRound = t > 0.93 ? Math.max(0.84, Math.sqrt(Math.max(0, 1 - ((t - 0.93) / 0.07) ** 2))) : 1
    const halfWidth = lerp(0.116, 0.205, smoothstep(0, 0.88, t)) * frontRound
    const centerX = lerp(0.01, 0.012, smoothstep(0, 0.88, t))
    const topHeight = lerp(0.132, 0.094, smoothstep(0, 0.88, t)) * Math.max(0.8, frontRound)
    const archLift = 0.02 * Math.exp(-(((t - 0.15) / 0.26) ** 2))
    const ring: Array<Vector3> = []
    for (let j = 0; j < crossSides; j++) {
      const angle = tau * j / crossSides
      const cosA = Math.cos(angle)
      const sinA = Math.sin(angle)
      const medialHollow = sinA < 0 ? 1 - 0.12 * Math.exp(-(((t - 0.12) / 0.24) ** 2)) * -sinA : 1
      const lx = centerX + halfWidth * medialHollow * Math.sign(sinA) * Math.abs(sinA) ** 0.84
      let ly: number
      if (cosA >= 0) {
        const dome = cosA ** 0.72 * topHeight
        // Clear sculptural dorsal extensor tendon ridges fanning down the top of the foot toward the 5 toes.
        const tendon = 0.0082 * Math.cos(10.5 * sinA + 0.3) * smoothstep(0.04, 0.72, t) * smoothstep(0.22, 0.86, cosA)
        ly = Math.max(0.01, dome + tendon)
      } else {
        const medialMask = smoothstep(0.1, -0.75, sinA)
        const edgeBevel = (1 - Math.abs(cosA)) ** 2 * 0.016
        ly = Math.max(0, edgeBevel + archLift * medialMask * (1 + 0.48 * cosA))
      }
      ring.push(footToWorld(lx, ly, z))
    }
    rings.push(ring)
  }
  const hipCap = new Vector3(hx, yTop, az)
  const forefootCap = footToWorld(0.018, 0.046, zBall + 0.014)
  const legFootVol = mesh.addClosedLoft(rings, hipCap, forefootCap)
  const thighMid = Math.floor(legSteps * 0.5)
  const hullFromRings = (indices: ReadonlyArray<number>, weight: number) => {
    const pts: Array<Vector3> = []
    for (const r of indices) {
      for (let j = 0; j < crossSides; j += 3) {
        pts.push(rings[r][j])
      }
    }
    return makeHull(pts, weight)
  }
  const thighHull = hullFromRings([0, Math.floor(thighMid / 2), thighMid], legFootVol * 0.24)
  const shinHull = hullFromRings([thighMid, Math.floor((thighMid + legSteps) / 2), legSteps], legFootVol * 0.22)
  const footHullPoints: Array<Vector3> = []
  for (const r of [legSteps + 4, legSteps + 6, legSteps + 9, rings.length - 4, rings.length - 1]) {
    for (let j = 0; j < crossSides; j += 3) {
      const p = rings[r][j]
      // Snap near-sole hull vertices flush to y = 0 so Rapier gets a clean flat resting polygon with zero sliver faces.
      footHullPoints.push(p.y < 0.015 ? new Vector3(p.x, 0, p.z) : p)
    }
  }
  // Exact flat sole anchor corners at y = 0 (heel pad + forefoot ball) so Rapier rests with zero rock.
  footHullPoints.push(
    footToWorld(-0.04, 0, -0.145),
    footToWorld(0.04, 0, -0.145),
    footToWorld(-0.14, 0, zBall),
    footToWorld(0.16, 0, zBall),
  )
  // Five plumper, cleanly nestled flat-resting toes with broad, deeply incised carved toenail beds!
  const toes = [
    {
      x: -0.128,
      z0: 0.452,
      len: 0.24,
      rx: 0.054,
      ry: 0.044,
      splay: -0.02,
    },
    {
      x: -0.024,
      z0: 0.456,
      len: 0.218,
      rx: 0.038,
      ry: 0.036,
      splay: -0.005,
    },
    {
      x: 0.054,
      z0: 0.446,
      len: 0.19,
      rx: 0.035,
      ry: 0.034,
      splay: 0.025,
    },
    {
      x: 0.122,
      z0: 0.422,
      len: 0.162,
      rx: 0.033,
      ry: 0.031,
      splay: 0.05,
    },
    {
      x: 0.176,
      z0: 0.39,
      len: 0.132,
      rx: 0.031,
      ry: 0.029,
      splay: 0.075,
    },
  ]
  const toeLenSteps = 12
  const toeSides = 12
  let toesVol = 0
  for (const toe of toes) {
    const toeRings: Array<Array<Vector3>> = []
    for (let i = 0; i <= toeLenSteps; i++) {
      const t = i / toeLenSteps
      // Smooth root seat tucked neatly inside the forefoot ball (zero medial bulge/bump).
      const z = toe.z0 - 0.045 + t * (toe.len + 0.045)
      const cxToe = toe.x + Math.sin(toe.splay) * Math.max(0, t - 0.22) * toe.len
      const rootBlend = 1 + 0.05 * smoothstep(0.22, 0, t)
      const shaftShape = rootBlend * (1 - 0.08 * Math.sin(Math.PI * t) + 0.12 * gaussian(t - 0.78, 0.14))
      const endCap = t > 0.84 ? Math.max(0.28, Math.sqrt(Math.max(0, 1 - ((t - 0.84) / 0.16) ** 2))) : 1
      const rx = toe.rx * shaftShape * endCap
      const ry = toe.ry * (1 + 0.08 * smoothstep(0.22, 0, t) - 0.05 * Math.sin(Math.PI * t) + 0.09 * gaussian(t - 0.76, 0.15)) * endCap
      const centerY = toe.ry * 0.92 * (t > 0.88 ? lerp(1, 0.78, (t - 0.88) / 0.12) : 1)
      const ring: Array<Vector3> = []
      for (let j = 0; j < toeSides; j++) {
        const angle = tau * j / toeSides
        const c = Math.cos(angle)
        const s = Math.sin(angle)
        const lx = cxToe + rx * c
        let ly = s < -0.18 ? Math.max(0, centerY + ry * s * 1.04) : centerY + ry * s
        // Broad, unmistakable carved toenail bed with crisp U-shaped cuticle groove & proud stone nail plate.
        if (t > 0.45 && t < 0.94 && s > 0.18) {
          const nt = (t - 0.72) / 0.175
          const nc = c / 0.78
          const nailR = Math.hypot(nt, nc)
          const topMask = smoothstep(0.2, 0.56, s)
          const groove = -0.011 * gaussian(nailR - 1, 0.15) * topMask
          const plate = 0.0055 * smoothstep(0.94, 0.64, nailR) * topMask
          ly += groove + plate
        }
        ring.push(footToWorld(lx, ly, z))
      }
      toeRings.push(ring)
    }
    const baseCap = footToWorld(toe.x, toe.ry * 0.92, toe.z0 - 0.05)
    const tipZ = toe.z0 + toe.len + 0.008
    const tipX = toe.x + Math.sin(toe.splay) * 0.8 * toe.len
    const tipCap = footToWorld(tipX, toe.ry * 0.56, tipZ)
    toesVol += mesh.addClosedLoft(toeRings, baseCap, tipCap)
    footHullPoints.push(footToWorld(tipX, 0, tipZ), footToWorld(tipX, toe.ry * 0.8, tipZ))
  }
  const footHull = makeHull(footHullPoints, legFootVol * 0.54 + toesVol)
  return [thighHull, shinHull, footHull]
}
/** Builds the chunky, full-barreled turned wooden baseball bat with visible handle butt and broad domed barrel end resting on y = 0. */
function buildBat(mesh: MeshBuilder): Array<Hull> {
  const knob = new Vector3(...sahurPose.batKnob)
  const tip = new Vector3(...sahurPose.batTip)
  const axis = tip.clone().sub(knob)
  const length = axis.length()
  const dir = axis.clone().normalize()
  const ref = new Vector3(0, 0, 1)
  const u = ref.clone().addScaledVector(dir, -ref.dot(dir)).normalize()
  const v = dir.clone().cross(u).normalize()
  const stations = 40
  const sides = 28
  const rings: Array<Array<Vector3>> = []
  // Chunky heavy baseball bat profile: turned pommel knob -> hefty grip -> full wide sweet-spot barrel -> broad classic domed end.
  const batRadius = (s: number) => {
    if (s < 0.036) {
      const k = s / 0.036
      return 0.022 + 0.044 * Math.sin(Math.PI * clamp(k, 0.06, 0.98)) ** 0.68
    }
    if (s < 0.064) {
      const k = (s - 0.036) / 0.028
      return lerp(0.062, 0.044, smoothstep(0, 1, k))
    }
    if (s < 0.92) {
      const k = (s - 0.064) / 0.856
      // Fuller sweet-spot barrel widening generously up to ~15 cm radius (~30 cm chunky diameter!).
      return 0.044 + 0.112 * k ** 1.05 * (1 - 0.045 * k * k)
    }
    // Broad classic domed barrel end (not egg-pointed).
    const k = clamp((s - 0.92) / 0.08, 0, 1)
    return Math.max(0.016, sahurPose.batTipRadius * (1 - k ** 2.4) ** (1 / 2.4))
  }
  for (let i = 0; i <= stations; i++) {
    const s = i / stations
    const dist = s <= 0.92 ? s / 0.92 * length : length + (s - 0.92) / 0.08 * sahurPose.batTipRadius
    const center = knob.clone().addScaledVector(dir, dist)
    const rBase = batRadius(s)
    const grainFade = smoothstep(0.06, 0.18, s) * smoothstep(0.94, 0.84, s)
    const ring: Array<Vector3> = []
    for (let j = 0; j < sides; j++) {
      const angle = tau * j / sides
      const grain = 0.002 * Math.sin(10 * angle + 0.4 * s) * grainFade
      const r = rBase + grain
      const p = center.clone().addScaledVector(u, r * Math.cos(angle)).addScaledVector(v, r * Math.sin(angle))
      if (p.y < 0) {
        p.y = 0
      }
      ring.push(p)
    }
    rings.push(ring)
  }
  const knobCap = knob.clone().addScaledVector(dir, -0.01)
  const tipCap = tip.clone().addScaledVector(dir, sahurPose.batTipRadius)
  tipCap.y = Math.max(0, tipCap.y)
  const volume = mesh.addClosedLoft(rings, knobCap, tipCap)
  const split = Math.floor(stations * 0.42)
  const hullFor = (indices: ReadonlyArray<number>, share: number) => {
    const pts: Array<Vector3> = []
    for (const r of indices) {
      for (let j = 0; j < sides; j += 3) {
        const p = rings[r][j]
        pts.push(p.y < 0.012 ? new Vector3(p.x, 0, p.z) : p)
      }
    }
    return makeHull(pts, volume * share)
  }
  return [
    hullFor([0, Math.floor(split / 2), split], 0.24),
    hullFor([split, Math.floor((split + stations) / 2), stations - 3, stations], 0.76),
  ]
}
