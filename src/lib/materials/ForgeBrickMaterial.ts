import type {Node} from 'three/webgpu'

import {atan, color, float, hash, max, min, mix, mx_noise_float, normalLocal, positionLocal, select, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {wallFace} from '../gallery/architectureDimensions.ts'
import {heightNormal, insideBy, visibleDetail} from './filters.ts'

type Float = Node<'float'>

/** height of one horizontal brick course (brick + mortar), in meters */
const courseHeight = 0.075
/** nominal width of one Flemish-bond pair (one stretcher + one header + two mortar joints), in meters */
const nominalPair = 0.34
/** share of a Flemish-bond pair occupied by the stretcher (the rest is the header) */
const stretcherShare = 0.66
/** nominal width of one upright brick in a soldier course, in meters */
const nominalSoldier = 0.076
/** half-width of a mortar joint, in meters */
const halfJoint = 0.0052
/** vertical bands for the upright soldier courses above the baseboard and below the cornice */
const lowerSoldier = [0.25, 0.475] as const
const upperSoldier = [4.805, 5.03] as const
const unit = (node: Float) => node.mul(0.5).add(0.5)

/**
 * Kiln-fired Flemish-bond foundry brick for the Forge’s walls: alternating stretchers and headers in toasted sienna, terracotta-umber, muted buff-clay and occasional kiln-flashed clinker bricks, bound in recessed warm ash-lime mortar, with upright soldier courses above the bluestone baseboard and below the cornice.
 *
 * Mapped in the wall’s own coordinates; on a curved ring wall (`curveRadius`), coordinates wrap around the inner face and snap to an integer number of Flemish-bond pairs and soldier bricks so there is no seam. Fine grain, chips and joints fade smoothly before they could shimmer.
 */
export default class ForgeBrickMaterial extends MeshStandardNodeMaterial {
  constructor({curveRadius}: {
    /** the wall’s signed bend radius, if it curves */
    curveRadius?: number
  } = {}) {
    super({
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.22,
    })
    this.name = 'Forge brick'
    const {x, y: height, z} = positionLocal
    const faceRadius = curveRadius ? Math.abs(curveRadius) - wallFace : 0
    const circumference = faceRadius * Math.PI * 2
    const ringPairs = curveRadius ? Math.max(1, Math.round(circumference / nominalPair)) : 0
    const ringSoldiers = curveRadius ? Math.max(1, Math.round(circumference / nominalSoldier)) : 0
    const pairWidth = curveRadius ? circumference / ringPairs : nominalPair
    const soldierWidth = curveRadius ? circumference / ringSoldiers : nominalSoldier
    // Bent, a point turns round the center of the bend at z = curveRadius in front of the wall’s middle.
    const turn = curveRadius ? atan(x.div(curveRadius), float(1).sub(z.div(curveRadius))).toVar('brickTurn') : float(0)
    const uFace = curveRadius ? turn.mul(faceRadius) : x
    const faceNormal = curveRadius ? normalLocal.xz.dot(vec2(turn.sin().negate(), turn.cos())) : normalLocal.z
    const isFace = faceNormal.abs().greaterThan(0.5)
    // Reveals wrap cleanly along z so masonry returns naturally into door and window openings.
    const u = select(isFace, uFace, z.add(x)).toVar('brickU')
    const v = height.toVar('brickV')
    // Continuous 3D sample point so noise never shows a seam at ±π on a ring wall.
    const worldPoint = vec3(x, height, z)
    const footprint = max(worldPoint.x.fwidth(), max(worldPoint.y.fwidth(), worldPoint.z.fwidth())).toVar('brickFootprint')
    const jointDetail = visibleDetail(footprint, 0.048)
    const fineDetail = visibleDetail(footprint, 0.014)
    // Upright soldier courses above the baseboard and below the cornice.
    const inLowerSoldier = v.greaterThanEqual(lowerSoldier[0]).and(v.lessThanEqual(lowerSoldier[1]))
    const inUpperSoldier = v.greaterThanEqual(upperSoldier[0]).and(v.lessThanEqual(upperSoldier[1]))
    const isSoldier = inLowerSoldier.or(inUpperSoldier).toVar('brickSoldier')
    const soldierTop = select(inLowerSoldier, float(lowerSoldier[1]), float(upperSoldier[1]))
    const soldierBottom = select(inLowerSoldier, float(lowerSoldier[0]), float(upperSoldier[0]))
    const soldierMidY = soldierTop.add(soldierBottom).mul(0.5)
    const soldierHalfH = soldierTop.sub(soldierBottom).mul(0.5)
    const soldierCoord = u.div(soldierWidth)
    const rawSoldierCol = soldierCoord.floor()
    const soldierCol = curveRadius ? rawSoldierCol.mod(ringSoldiers).add(ringSoldiers).mod(ringSoldiers) : rawSoldierCol
    const soldierLocalU = soldierCoord.fract().sub(0.5).mul(soldierWidth)
    const soldierEdgeU = float(soldierWidth * 0.5).sub(soldierLocalU.abs())
    const soldierEdgeV = soldierHalfH.sub(v.sub(soldierMidY).abs())
    const soldierKey = select(inLowerSoldier, float(80_000), float(90_000)).add(soldierCol.add(4000))
    // Main Flemish-bond courses: alternating stretchers and headers, staggered by half a pair each course.
    const rowCoord = v.sub(lowerSoldier[1]).div(courseHeight)
    const row = rowCoord.floor().toVar('brickRow')
    const oddRow = row.mod(2).abs().greaterThan(0.5)
    const pairOffset = select(oddRow, float(pairWidth * 0.5), float(0))
    const pairCoord = u.add(pairOffset).div(pairWidth)
    const rawPairCol = pairCoord.floor()
    const pairCol = curveRadius ? rawPairCol.mod(ringPairs).add(ringPairs).mod(ringPairs) : rawPairCol
    const inPair = pairCoord.fract().toVar('brickInPair')
    const isHeader = inPair.greaterThanEqual(stretcherShare)
    const brickWidth = select(isHeader, float(pairWidth * (1 - stretcherShare)), float(pairWidth * stretcherShare))
    const localU = select(isHeader, inPair.sub(stretcherShare).div(1 - stretcherShare), inPair.div(stretcherShare)).sub(0.5).mul(brickWidth)
    const localV = rowCoord.fract().sub(0.5).mul(courseHeight)
    const flemishEdgeU = brickWidth.mul(0.5).sub(localU.abs())
    const flemishEdgeV = float(courseHeight * 0.5).sub(localV.abs())
    const flemishKey = row.add(200).mul(1999).add(pairCol.add(4000).mul(2)).add(select(isHeader, float(1), float(0)))
    // Unified brick metrics for whichever band the fragment lies in.
    const brickKey = select(isSoldier, soldierKey, flemishKey).toVar('brickKey')
    const random = (stream: number) => hash(brickKey.add(stream * 1_048_573))
    const edgeU = select(isSoldier, soldierEdgeU, flemishEdgeU)
    const edgeV = select(isSoldier, soldierEdgeV, flemishEdgeV)
    const rawEdge = min(edgeU, edgeV).toVar('brickRawEdge')
    // Subtle hand-molded edge irregularity and small kiln chips.
    const wobble = mx_noise_float(worldPoint.mul(22).add(vec3(0, 0, random(1).mul(20)))).mul(0.0018)
    const chipNoise = unit(mx_noise_float(worldPoint.mul(48).add(vec3(0, 0, random(2).mul(30)))))
    const chips = chipNoise.smoothstep(0.68, 0.92).mul(0.0045)
    const edge = rawEdge.sub(wobble.add(chips).mul(jointDetail)).toVar('brickEdge')
    const brickMask = mix(float(0.84), insideBy(float(halfJoint).sub(edge), footprint), jointDetail).toVar('brickMask')
    // Harmonious historical smoked-foundry brick palette: calm, cohesive muted terracotta-umber, weathered clay and subtle darker kiln bricks without confetti noise.
    const pick = random(3)
    const shade = random(4).sub(0.5).mul(0.075).add(1)
    const isClinker = pick.greaterThanEqual(0.9).toVar('brickClinker')
    const baseBrick = select(
      pick.lessThan(0.35),
      color('#6d473a'),
      select(
        pick.lessThan(0.68),
        color('#795142'),
        select(
          pick.lessThan(0.9),
          color('#725245'),
          color('#573c33'),
        ),
      ),
    ).mul(shade)
    // Subtle firing variation across each brick + gentle broad masonry wash + fine clay tooth.
    const seed = random(5).mul(70)
    const firing = unit(mx_noise_float(worldPoint.mul(5.5).add(vec3(seed, 0, seed.mul(0.7)))))
    const wash = unit(mx_noise_float(worldPoint.mul(0.45).add(vec3(2.3, 1.1, 4.7))))
    const grain = mix(float(0.5), unit(mx_noise_float(worldPoint.mul(95).add(vec3(0, seed, 0)))), fineDetail)
    const pores = mix(float(0), unit(mx_noise_float(worldPoint.mul(180).add(vec3(seed, 0, 1.5)))).smoothstep(0.76, 0.92), fineDetail)
    const scorch = unit(mx_noise_float(worldPoint.mul(2.1).add(vec3(0, seed, 3.1)))).smoothstep(0.65, 0.95).mul(random(6).smoothstep(0.55, 0.95))
    const brickColor = baseBrick
      .mul(firing.sub(0.5).mul(0.11).add(wash.sub(0.5).mul(0.14)).add(grain.sub(0.5).mul(0.1)).sub(pores.mul(0.16)).add(1))
      .mul(scorch.mul(-0.14).add(1))
    // Recessed warm charcoal-ash lime mortar, darkened under the brick above for crisp course definition.
    const mortarSand = mix(float(0.5), unit(mx_noise_float(worldPoint.mul(160))), fineDetail)
    const lv = select(isSoldier, v.sub(soldierMidY), localV)
    const underShadow = select(lv.greaterThan(0), float(0.68), float(0.92))
    const mortar = mix(color('#585046'), color('#6d6458'), mortarSand).mul(underShadow)
    // Crisp shoulder bevel into the recessed mortar joint.
    const shoulder = edge.sub(halfJoint).div(0.0085).clamp(0, 1).smoothstep(0, 1)
    let surface: Node<'vec3'> = mix(mortar, brickColor.mul(shoulder.mul(0.16).add(0.84)), brickMask)
    // Subtle workshop patina grounding the lower wall and warming under the cornice.
    const floorDamp = v.smoothstep(0.24, 0.95).oneMinus().mul(0.15)
    const corniceSoot = v.smoothstep(4.45, 5.25).mul(0.14)
    surface = surface.mul(float(1).sub(floorDamp).sub(corniceSoot))
    // Thin dark shadow grooves framing the soldier courses.
    const lowerGroove = v.sub(lowerSoldier[1]).abs().lessThan(0.007)
    const upperGroove = v.sub(upperSoldier[0]).abs().lessThan(0.007)
    const groove = select(lowerGroove.or(upperGroove), float(0.72), float(1))
    surface = surface.mul(mix(float(1), groove, jointDetail))
    // Keep recessed course definition visible across the full room before fading softly.
    this.colorNode = mix(brickColor.mul(0.9), surface, jointDetail.mul(0.85).add(0.15))
    // Subtle satin kiln-sheen variation so warm pendant lamps catch gentle raking highlights on the brickwork.
    const brickRough = select(isClinker, float(0.6), float(0.78)).add(grain.sub(0.5).mul(0.06)).sub(scorch.mul(0.08))
    this.roughnessNode = mix(float(0.96), brickRough, brickMask)
    // Tactile masonry height relief: recessed mortar, slight per-brick tilt and pillowed brick face.
    const tilt = random(7).sub(0.5).mul(0.0018).mul(select(isSoldier, soldierLocalU, localU).div(0.12))
    const faceRelief = shoulder.mul(0.0042).add(tilt).add(grain.sub(0.5).mul(0.0006)).sub(pores.mul(0.0009))
    const mortarRelief = mortarSand.mul(0.0005).sub(0.0052)
    this.normalNode = heightNormal(mix(mortarRelief, faceRelief, shoulder).mul(jointDetail))
  }
}
