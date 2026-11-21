import type {Hull, MeshBuilder} from './meshBuilder.ts'

import {Vector3} from 'three/webgpu'

import {sahurPose} from './config.ts'
import {clamp, gaussian, lerp, makeHull, smoothstep, sweepTube, tau} from './meshBuilder.ts'

/** Builds the seamless sculpted head + straight log torso mesh and returns its stacked physics hulls. */
export function buildHeadTorso(mesh: MeshBuilder): Array<Hull> {
  const sides = 96
  const ys = verticalStations()
  const rings: Array<Array<Vector3>> = ys.map(y => {
    const ring: Array<Vector3> = []
    for (let j = 0; j < sides; j++) {
      ring.push(headTorsoPoint(faceAngle(j, sides), y))
    }
    return ring
  })
  const bottomCap = new Vector3(sahurPose.cx, sahurPose.bodyBottomY, sahurPose.cz)
  const topCap = new Vector3(sahurPose.cx, sahurPose.bodyTopY, sahurPose.cz)
  const volume = mesh.addClosedLoft(rings, bottomCap, topCap)
  const splits = [0, 14, 46, rings.length - 1]
  const hulls: Array<Hull> = []
  for (let s = 0; s < splits.length - 1; s++) {
    const r0 = splits[s]
    const r1 = splits[s + 1]
    const rm = Math.floor((r0 + r1) / 2)
    const pts: Array<Vector3> = []
    for (const r of [r0, rm, r1]) {
      for (let j = 0; j < sides; j += 4) {
        pts.push(rings[r][j])
      }
    }
    if (s === 0) {
      pts.push(bottomCap)
    }
    if (s === splits.length - 2) {
      pts.push(topCap)
    }
    const heightShare = (ys[r1] - ys[r0]) / (sahurPose.bodyTopY - sahurPose.bodyBottomY)
    hulls.push(makeHull(pts, volume * heightShare))
  }
  return hulls
}

/**
 * Builds both oversized cartoon eyeballs in classical carved-stone style:
 * wide open smooth sclera, crisp incised iris groove, deeply hollowed steep-walled pupil cavity that traps dark shadow, and a subtle catchlight wedge at its upper-left rim.
 */
export function buildEyeballs(mesh: MeshBuilder) {
  const {cx, cz, eyeCenterZ, eyeOffsetX, eyeRadius, eyeY} = sahurPose
  const radial = 40
  const alphas = [
    0.04,
    0.12,
    0.2,
    0.245,
    0.268,
    0.285,
    0.31,
    0.39,
    0.465,
    0.495,
    0.52,
    0.555,
    0.65,
    0.78,
    0.96,
    1.24,
    1.65,
    2.22,
    2.75,
  ]
  for (const side of [-1, 1] as const) {
    const center = new Vector3(cx + side * eyeOffsetX, eyeY, cz + eyeCenterZ)
    const yaw = side * 0.12
    const cosY = Math.cos(yaw)
    const sinY = Math.sin(yaw)
    const toWorld = (lx: number, ly: number, lz: number) => new Vector3(
      center.x + lx * cosY + lz * sinY,
      center.y + ly,
      center.z - lx * sinY + lz * cosY,
    )
    const rings: Array<Array<Vector3>> = alphas.map(alpha => {
      const ring: Array<Vector3> = []
      const sinA = Math.sin(alpha)
      const cosA = Math.cos(alpha)
      for (let j = 0; j < radial; j++) {
        const phi = tau * j / radial
        let r = eyeRadius
        // Tiny crisp stone catchlight notch right at the upper-left rim of the deep pupil pit.
        const catchlightPhi = 2.3
        const dPhi = Math.atan2(Math.sin(phi - catchlightPhi), Math.cos(phi - catchlightPhi))
        const catchlightRim = Math.exp(-0.5 * (dPhi / 0.22) ** 2) * smoothstep(0.16, 0.24, alpha) * smoothstep(0.32, 0.26, alpha)
        // Deep, razor-steep carved pupil cavity (-5.6 cm) so overhead daylight casts a dark, unmistakable staring pupil.
        if (alpha < 0.285) {
          const u = alpha / 0.285
          const pitDepth = 0.056 * (1 - u ** 6)
          r -= pitDepth * (1 - 0.78 * catchlightRim)
        }
        // Clean incised iris limbal ring leaving wide, smooth bright sclera all around the iris.
        r -= 0.008 * gaussian(alpha - 0.505, 0.02)
        const lx = r * sinA * Math.cos(phi)
        const ly = r * sinA * Math.sin(phi)
        const lz = r * cosA
        ring.push(toWorld(lx, ly, lz))
      }
      return ring
    })
    const frontCap = toWorld(0, 0, eyeRadius - 0.056)
    const backCap = toWorld(0, 0, -eyeRadius)
    mesh.addClosedLoft(rings, frontCap, backCap)
  }
}

/**
 * Builds organic sculpted upper and lower eyelids wrapping smoothly over each giant eyeball:
 * heavier upper lid blending upward into the brow socket, crisper thin inner lower rim feathering softly down into the cheek.
 */
export function buildEyelids(mesh: MeshBuilder) {
  const {cx, cz, eyeCenterZ, eyeOffsetX, eyeRadius, eyeY} = sahurPose
  const aroundEye = 36
  const crossSides = 12
  // Asymmetric eyelid cross-section: crisp inner rim hugging the eyeball, broad outer apron tapering smoothly back into the socket wall.
  const profile: Array<readonly [out: number, back: number]> = [
    [-0.006, 0.009],
    [0.004, 0.015],
    [0.017, 0.012],
    [0.034, -0.003],
    [0.052, -0.024],
    [0.062, -0.052],
    [0.04, -0.072],
    [0.012, -0.074],
    [-0.012, -0.058],
    [-0.018, -0.034],
    [-0.015, -0.012],
    [-0.01, 0.001],
  ]
  for (const side of [-1, 1] as const) {
    const center = new Vector3(cx + side * eyeOffsetX, eyeY, cz + eyeCenterZ)
    const yaw = side * 0.12
    const cosY = Math.cos(yaw)
    const sinY = Math.sin(yaw)
    const toWorld = (lx: number, ly: number, lz: number) => new Vector3(
      center.x + lx * cosY + lz * sinY,
      center.y + ly,
      center.z - lx * sinY + lz * cosY,
    )
    const rings: Array<Array<Vector3>> = []
    for (let i = 0; i < aroundEye; i++) {
      const a = tau * i / aroundEye
      const c = Math.cos(a)
      const s = Math.sin(a)
      // Softly tapered almond opening without harsh pinched V-corners.
      const cornerCurve = Math.abs(s) ** 0.91
      const upper = Math.max(0, s)
      const lower = Math.max(0, -s)
      const rxOpen = 0.133
      const ryOpen = upper * 0.112 + lower * 0.118
      const lx0 = side * rxOpen * c
      const ly0 = Math.sign(s) * ryOpen * cornerCurve
      const r2 = lx0 * lx0 + ly0 * ly0
      const lz0 = Math.sqrt(Math.max(0.002, eyeRadius * eyeRadius - r2))
      const outX = side * c
      const outY = s
      const outLen = Math.hypot(outX, outY) || 1
      const ox = outX / outLen
      const oy = outY / outLen
      // Sleek sculptural upper hood blending up into the brow socket; crisp thin lower rim exposing wide smooth sclera.
      const outScale = 0.5 + 0.62 * upper + 0.2 * lower
      const thicknessScale = 0.54 + 0.46 * upper + 0.16 * lower
      const ring: Array<Vector3> = []
      for (let j = 0; j < crossSides; j++) {
        const [pOut, pBack] = profile[j]
        const lx = lx0 + ox * pOut * outScale
        const ly = ly0 + oy * pOut * outScale
        const hoodOverhang = pBack > 0 ? 0.013 * upper : 0
        const lz = lz0 + pBack * thicknessScale + hoodOverhang
        ring.push(toWorld(lx, ly, lz))
      }
      rings.push(ring)
    }
    const startIndex = mesh.indices.length
    const ringIndices = rings.map(ring => ring.map(p => mesh.vertex(p)))
    for (let i = 0; i < aroundEye; i++) {
      const a = ringIndices[i]
      const b = ringIndices[(i + 1) % aroundEye]
      for (let j = 0; j < crossSides; j++) {
        const k = (j + 1) % crossSides
        mesh.indices.push(a[j], a[k], b[k], a[j], b[k], b[j])
      }
    }
    if (mesh.signedVolume(startIndex, mesh.indices.length) < 0) {
      for (let i = startIndex; i < mesh.indices.length; i += 3) {
        const tmp = mesh.indices[i + 1]
        mesh.indices[i + 1] = mesh.indices[i + 2]
        mesh.indices[i + 2] = tmp
      }
    }
  }
}

/** Builds both thick, low-set arched eyebrows rooted smoothly into the brow bone with directional hair-tuft relief. */
export function buildEyebrows(mesh: MeshBuilder) {
  const {cx, cz} = sahurPose
  const stations = 20
  const sides = 10
  for (const side of [-1, 1] as const) {
    const spine: Array<Vector3> = []
    for (let i = 0; i <= stations; i++) {
      const t = i / stations
      const ax = lerp(0.03, 0.344, t)
      const arch = Math.sin(Math.PI * t ** 0.8)
      const y = lerp(3.385, 3.348, t) + 0.068 * arch
      const theta = Math.asin(clamp(ax / 0.39, -0.95, 0.95))
      // Sink roots gently deeper into the brow bone at both inner and outer ends so there are no abrupt pasted edges.
      const endSink = 0.022 * (1 - Math.sin(Math.PI * t)) ** 1.4
      const z = 0.352 * Math.cos(theta) + 0.012 * (1 - 0.3 * t) - endSink
      spine.push(new Vector3(cx + side * ax, y, cz + z))
    }
    const rings = sweepTube(spine, sides, (t, angle) => {
      // Smooth rounded taper at BOTH inner root and outer temple tail (no squared banana ends).
      const taper = Math.sin(Math.PI * clamp(t, 0.02, 0.98)) ** 0.72
      const thickProfile = lerp(1.12, 0.56, t)
      const frontFactor = smoothstep(-0.15, 0.55, Math.cos(angle))
      // Crisp directional carved hair-tuft flutes angling upward and outward along the brow.
      const tuft = 1 + 0.125 * Math.sin(t * 46 - angle * 1.8) * frontFactor
      const rDepth = 0.044 * taper * tuft
      const rHeight = 0.05 * taper * thickProfile
      return [rDepth, rHeight] as const
    }, new Vector3(0, 0, 1))
    mesh.addClosedLoft(rings, spine[0], spine.at(-1))
  }
}

/** Builds vertical station heights packed densely across the chin, lips, nose, smiling cheeks and eye sockets. */
function verticalStations() {
  const ys: Array<number> = []
  const addRange = (start: number, end: number, steps: number, includeEnd = false) => {
    for (let i = 0; i < (includeEnd ? steps + 1 : steps); i++) {
      ys.push(lerp(start, end, i / steps))
    }
  }
  // Flat beveled bottom edge of log
  addRange(sahurPose.bodyBottomY, 1.475, 4)
  // Straight vertical lower wooden log torso
  addRange(1.475, 2.34, 10)
  // Soft blended rounded central chin
  addRange(2.34, 2.56, 8)
  // Wide smile, fuller upper lip, lower lip & corners (ultra dense)
  addRange(2.56, 2.78, 13)
  // Plump nose tip, distinct alar wings, recessed nostrils & bridge (ultra dense)
  addRange(2.78, 3.02, 13)
  // High cheekbones & smooth eye socket basins
  addRange(3.02, 3.44, 13)
  // Low brow ridge & short forehead
  addRange(3.44, 3.66, 5)
  // Flat-topped beveled log crown
  addRange(3.66, sahurPose.bodyTopY, 6, true)
  return ys
}
/** Non-uniform angle theta in [-pi, pi], ~4x denser across the front face (theta = 0 is +Z). */
function faceAngle(index: number, sides: number) {
  const s = 2 * index / sides - 1
  return Math.PI * s - 0.56 * Math.sin(Math.PI * s)
}
/** Evaluates a sculpted point on the head + straight wooden log torso surface. */
function headTorsoPoint(theta: number, y: number) {
  const {bodyBottomY, bodyRx, bodyRz, bodyTopY, cx, cz, eyeOffsetX, eyeY} = sahurPose
  const sinT = Math.sin(theta)
  const cosT = Math.cos(theta)
  // Hefty straight-sided log cylinder with crisp beveled bottom and flat-topped beveled crown.
  const bottomH = 0.052
  const topH = 0.12
  let capScale = 1
  if (y < bodyBottomY + bottomH) {
    const t = clamp((y - bodyBottomY) / bottomH, 0, 1)
    capScale = 0.86 + 0.14 * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2))
  } else if (y > bodyTopY - topH) {
    const t = clamp((y - (bodyTopY - topH)) / topH, 0, 1)
    capScale = Math.max(0.06, (1 - t ** 3.6) ** (1 / 3.6))
  }
  // Straight hefty log width from top to bottom.
  const headWidth = 1 + 0.024 * smoothstep(2.55, 3.05, y) * smoothstep(3.75, 3.55, y)
  let x = bodyRx * capScale * headWidth * sinT
  let z = bodyRz * capScale * headWidth * cosT
  // Smooth high cheekbone flare beneath the outer lower eyelids (broad smooth envelope to avoid diagonal shading lines).
  const frontHalf = smoothstep(-0.4, 0.4, cosT)
  const highCheekBand = gaussian(y - 2.97, 0.14)
  const lateralMask = smoothstep(0.35, 1.12, Math.abs(theta)) * smoothstep(1.92, 1.15, Math.abs(theta))
  x += Math.sign(sinT) * 0.042 * highCheekBand * lateralMask
  z += 0.022 * highCheekBand * lateralMask * frontHalf
  // Facial relief on the front hemisphere (strictly smooth across x = 0 via symmetric pair sums).
  if (cosT > -0.2 && y > 2.3 && y < 3.68) {
    const faceFade = smoothstep(-0.2, 0.3, cosT) * smoothstep(2.3, 2.42, y) * smoothstep(3.68, 3.56, y)
    let dz = 0
    let dxExtra = 0
    // 1. Smooth generous eye socket basins & plump smiling cheek fullness below them.
    for (const side of [-1, 1] as const) {
      const ex = x - side * eyeOffsetX
      const ey = y - eyeY
      const basinDist = Math.hypot(ex / 0.144, ey / 0.126)
      dz -= 0.088 * Math.exp(-0.5 * basinDist ** 2.3)
      // High zygomatic cheekbone dome blending smoothly down into plump smiling cheek apples.
      const cheekDist = Math.hypot((x - side * 0.228) / 0.12, (y - 2.95) / 0.1)
      const cheekBump = Math.exp(-0.5 * cheekDist * cheekDist)
      dz += 0.066 * cheekBump
      dxExtra += side * 0.016 * cheekBump
      // Warm lower smiling cheek fullness bridging cheek to smile corners.
      const appleDist = Math.hypot((x - side * 0.21) / 0.095, (y - 2.82) / 0.085)
      dz += 0.032 * Math.exp(-0.5 * appleDist * appleDist)
      // Smooth brow bone cushion supporting the thick low-set eyebrows seamlessly.
      const browY = 3.405 + 0.022 * Math.exp(-0.5 * ((x - side * 0.175) / 0.09) ** 2)
      const browMask = Math.exp(-0.5 * (((x - side * 0.175) / 0.13) ** 2 + ((y - browY) / 0.06) ** 2))
      dz += 0.038 * browMask
    }
    // 2. Crisp narrow vertical nose bridge, plump bulbous tip, clearly separated alar lobes and real recessed nostrils.
    const bridgeT = smoothstep(3.31, 2.91, y)
    const bridgeSigma = lerp(0.027, 0.04, bridgeT)
    const bridgeProfile = smoothstep(3.35, 3.22, y) * smoothstep(2.81, 2.89, y)
    dz += lerp(0.056, 0.132, bridgeT) * gaussian(x, bridgeSigma) * bridgeProfile
    // Plump, rounded bulbous nose tip.
    const tipDist = Math.hypot(x / 0.055, (y - 2.885) / 0.045)
    dz += 0.082 * Math.exp(-0.5 * tipDist * tipDist)
    // Clearly separated fleshy nostril wings (alae), crisp alar creases and deep sculpted nostril openings.
    for (const side of [-1, 1] as const) {
      const alaDist = Math.hypot((x - side * 0.064) / 0.033, (y - 2.852) / 0.029)
      dz += 0.084 * Math.exp(-0.5 * alaDist * alaDist)
      // Crisp curved alar crease separating nostril wing from cheek.
      const alarCrease = Math.hypot((x - side * 0.098) / 0.018, (y - 2.862) / 0.036)
      dz -= 0.026 * Math.exp(-0.5 * alarCrease * alarCrease)
      // Deep sculpted dark recessed nostril openings underneath.
      const nostrilDist = Math.hypot((x - side * 0.038) / 0.019, (y - 2.816) / 0.016)
      dz -= 0.072 * Math.exp(-0.5 * nostrilDist * nostrilDist)
    }
    // Crisp horizontal shadow overhang directly under the nose tip and septum.
    dz -= 0.028 * gaussian(y - 2.804, 0.015) * gaussian(x, 0.078)
    // Subtle philtrum dimple above upper lip Cupid's bow.
    dz -= 0.011 * gaussian(x, 0.015) * gaussian(y - 2.755, 0.028)
    // 3. Wide confident smile with fuller softly overhanging upper lip, rounder central lower lip and dimpled corners.
    const mouthHalfW = 0.235
    const mouthU2 = Math.min(1.5, (x / mouthHalfW) ** 2)
    const mouthCurveY = 2.662 + 0.072 * mouthU2
    const dyMouth = y - mouthCurveY
    const mouthSpan = smoothstep(mouthHalfW + 0.036, mouthHalfW - 0.03, Math.abs(x))
    const mouthCreaseSpan = smoothstep(mouthHalfW + 0.018, mouthHalfW - 0.016, Math.abs(x))
    // Deep, crisp V-cut smile parting groove.
    dz -= 0.044 * gaussian(dyMouth, 0.0115) * mouthCreaseSpan
    // Deep upturned smile corner dimples and soft cheek folds wrapping around them.
    for (const side of [-1, 1] as const) {
      const cornerDist = Math.hypot((x - side * mouthHalfW) / 0.024, (y - (2.662 + 0.072)) / 0.024)
      dz -= 0.03 * Math.exp(-0.5 * cornerDist * cornerDist)
      const foldDist = Math.hypot((x - side * (mouthHalfW + 0.044)) / 0.04, (y - 2.755) / 0.065)
      dz += 0.03 * Math.exp(-0.5 * foldDist * foldDist)
    }
    // Fuller, softly overhanging upper lip with subtle Cupid's bow and central tubercle.
    const cupidsBow = 0.006 * Math.cos(x * 26) * gaussian(x, 0.075)
    const upperFullness = 1 + 0.22 * gaussian(x, 0.085)
    dz += 0.062 * upperFullness * gaussian(dyMouth - (0.025 + cupidsBow), 0.021) * mouthSpan
    // Rounder central lower lip tapering gracefully toward the smile corners.
    const lowerLipSpan = smoothstep(mouthHalfW + 0.005, mouthHalfW - 0.068, Math.abs(x))
    const lowerCentral = 1 + 0.18 * gaussian(x, 0.09)
    dz += 0.064 * lowerCentral * gaussian(dyMouth + 0.032, 0.025) * lowerLipSpan
    // 4. Soft labiomental dip and rounder blended central chin mound (NO stiff full-width horizontal bar).
    dz -= 0.022 * gaussian(y - 2.576, 0.023) * gaussian(x, 0.115)
    const chinDist = Math.hypot(x / 0.125, (y - 2.502) / 0.058)
    dz += 0.056 * Math.exp(-0.5 * chinDist * chinDist)
    // Gentle soft shadow hollow directly beneath the center of the chin, fading smoothly into the vertical log.
    dz -= 0.012 * gaussian(y - 2.415, 0.032) * gaussian(x, 0.105)
    z += dz * faceFade
    x += dxExtra * faceFade
  }
  // Carved vertical wood-grain flutes along the log sides, back and lower torso (kept clear of the face).
  const onFace = smoothstep(2.38, 2.5, y) * smoothstep(3.66, 3.52, y) * smoothstep(1.26, 0.72, Math.abs(theta))
  const grainMask = (1 - onFace) * smoothstep(bodyBottomY, bodyBottomY + 0.08, y) * smoothstep(bodyTopY, bodyTopY - 0.12, y)
  if (grainMask > 1e-4) {
    const drift = 0.22 * Math.sin(y * 1.3)
    const grain = 0.0052 * Math.sin(16 * theta + drift) + 0.0028 * Math.sin(31 * theta - 0.7 * drift + 1.1)
    const radialLen = Math.hypot(x, z)
    if (radialLen > 1e-4) {
      const scale = 1 + grain * grainMask / radialLen
      x *= scale
      z *= scale
    }
  }
  return new Vector3(cx + x, y, cz + z)
}
