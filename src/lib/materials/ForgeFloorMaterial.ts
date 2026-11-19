import type {Node} from 'three/webgpu'

import {atan, color, float, hash, max, min, mix, mx_fractal_noise_float, mx_noise_float, normalWorldGeometry, positionWorld, select, vec2, vec3} from 'three/tsl'

import {heightNormal, insideBy, visibleDetail} from './filters.ts'
import FloorMaterial from './FloorMaterial.ts'

export type ForgeFloorPlan = {
  radius: number
} | {
  size: readonly [number, number]
}
export type ForgeFloorOptions = ForgeFloorPlan & {
  /** the middle of the floor plan in world x/z */
  center: readonly [number, number]
  /** radius of the Gaussian blur on the honed reflection, in 1080p pixels */
  gaussianBlur?: number
  /** extra share of the mirror at grazing angles */
  grazingStrength?: number
  /** width of the darker perimeter stone border measured from the wall center lines */
  inset?: number
  /** mip level the mirror is read at */
  loss?: number
  /** whether the honed stone mirrors the room (heavy mode) */
  reflections?: boolean
  /** base roughness of the honed flagstones in heavy mode */
  roughness?: number
  /** share of the mirror when looking straight down */
  strength?: number
}

type Float = Node<'float'>

/** half-width of the recessed mortar joints between flagstones, in meters */
const halfJoint = 0.0038
/** rectangular flagstone dimensions in meters (across x, along z) */
const flagSize = [0.64, 0.96] as const
/** border slab spacing along the walls, in meters */
const borderStep = 0.85
/** central circular keystone radius in the round vestibule, in meters */
const keystoneRadius = 0.54
const unit = (node: Float) => node.mul(0.5).add(0.5)

/**
 * Honed basalt and Belgian bluestone flagstones for the Forge and its round vestibule, mapped in world coordinates.
 *
 * Rectangular halls are paved in running-bond basalt flagstones framed by a darker perimeter border along the brass inlay line, with a subtle trodden satin sheen down the central aisle. Round vestibules radiate in concentric courses of dressed wedge flagstones around a central circular keystone.
 * In heavy mode the honed stone mirrors the room softly (and never inside the recessed mortar joints).
 */
export default class ForgeFloorMaterial extends FloorMaterial {
  constructor(options: ForgeFloorOptions) {
    const {center, gaussianBlur = 6, grazingStrength = 0.11, inset = 1.25, loss = 3.2, reflections = true, roughness = 0.56, strength = 0.04} = options
    if (!('radius' in options ? options.radius > 0 : options.size[0] > 0 && options.size[1] > 0) || inset < 0) {
      throw new RangeError('A Forge floor needs a positive size or radius and a border inset of at least zero.')
    }
    const worldXZ = positionWorld.xz.toVar('forgeFloorXZ')
    const local = worldXZ.sub(vec2(...center)).toVar('forgeFloorLocal')
    const footprint = max(positionWorld.x.fwidth(), positionWorld.z.fwidth()).toVar('forgeFloorFootprint')
    const jointDetail = visibleDetail(footprint, 0.018)
    const fineDetail = visibleDetail(footprint, 0.006)
    let rawEdge: Float
    let slabKey: Float
    let inBorder: Float
    let aisleWear: Float
    if ('radius' in options) {
      const fieldOuter = Math.max(keystoneRadius + 0.1, options.radius - inset)
      const midRing = (keystoneRadius + fieldOuter) * 0.5
      const r = local.length().toVar('forgeFloorR')
      // Angle wrapped smoothly into [0, 1)
      const angle = atan(local.y, local.x).div(Math.PI * 2).add(0.5).toVar('forgeFloorAngle')
      const isKeystone = r.lessThan(keystoneRadius)
      const isInner = r.greaterThanEqual(keystoneRadius).and(r.lessThan(midRing))
      const isMiddle = r.greaterThanEqual(midRing).and(r.lessThan(fieldOuter))
      inBorder = r.greaterThanEqual(fieldOuter).select(float(1), float(0))
      const sectors = select(isInner, float(12), select(isMiddle, float(16), float(20)))
      const phase = select(isMiddle, float(0.5), float(0))
      const sectorCoord = angle.mul(sectors).add(phase)
      const sectorId = sectorCoord.floor().mod(sectors)
      const sectorFrac = sectorCoord.fract().sub(0.5).abs()
      // Arc-length distance to the nearest radial joint, in meters
      const edgeAngle = float(0.5).sub(sectorFrac).mul(Math.PI * 2).div(sectors).mul(r.max(0.05))
      const innerR = select(isInner, float(keystoneRadius), select(isMiddle, float(midRing), float(fieldOuter)))
      const outerR = select(isInner, float(midRing), select(isMiddle, float(fieldOuter), float(options.radius + 1.5)))
      const edgeRing = min(r.sub(innerR), outerR.sub(r))
      const wedgeEdge = min(edgeAngle, edgeRing)
      rawEdge = select(isKeystone, float(keystoneRadius).sub(r), wedgeEdge).toVar('forgeFloorRawEdge')
      const ringId = select(isKeystone, float(0), select(isInner, float(1), select(isMiddle, float(2), float(3))))
      slabKey = ringId.mul(1009).add(select(isKeystone, float(17), sectorId.add(100))).toVar('forgeFloorSlabKey')
      // Central stone wears slightly smoother under footsteps
      aisleWear = r.smoothstep(2.2, 0.2).mul(0.6)
    } else {
      const [halfX, halfZ] = [options.size[0] / 2, options.size[1] / 2]
      const toWallX = float(halfX).sub(local.x.abs())
      const toWallZ = float(halfZ).sub(local.y.abs())
      const toWall = min(toWallX, toWallZ)
      inBorder = toWall.lessThan(inset).select(float(1), float(0))
      // Running-bond flagstones in the main field
      const colCoord = local.x.div(flagSize[0])
      const col = colCoord.floor()
      const stagger = col.mod(2).abs().greaterThan(0.5).select(float(0.5), float(0))
      const rowCoord = local.y.div(flagSize[1]).add(stagger)
      const row = rowCoord.floor()
      const fieldEdgeX = float(0.5).sub(colCoord.fract().sub(0.5).abs()).mul(flagSize[0])
      const fieldEdgeZ = float(0.5).sub(rowCoord.fract().sub(0.5).abs()).mul(flagSize[1])
      const fieldEdge = min(fieldEdgeX, fieldEdgeZ)
      const fieldKey = row.add(500).mul(1999).add(col.add(500))
      // Broader dressed slabs in the perimeter border, running along whichever wall is nearer
      const alongX = toWallZ.lessThan(toWallX)
      const borderCoord = select(alongX, local.x, local.y).div(borderStep)
      const borderCol = borderCoord.floor()
      const borderEdgeAlong = float(0.5).sub(borderCoord.fract().sub(0.5).abs()).mul(borderStep)
      const borderEdgeAcross = min(float(inset).sub(toWall), toWall)
      const borderEdge = min(borderEdgeAlong, borderEdgeAcross)
      const borderSide = select(alongX, local.y.greaterThan(0).select(float(1), float(2)), local.x.greaterThan(0).select(float(3), float(4)))
      const borderKey = borderSide.mul(10_007).add(borderCol.add(500))
      rawEdge = select(inBorder.greaterThan(0.5), borderEdge, fieldEdge).toVar('forgeFloorRawEdge')
      slabKey = select(inBorder.greaterThan(0.5), borderKey, fieldKey).toVar('forgeFloorSlabKey')
      // Foot traffic wears a gentle satin sheen down the central aisle
      aisleWear = local.x.abs().smoothstep(2.4, 0.4).mul(local.y.abs().smoothstep(7.2, 5.2)).mul(0.75)
    }
    const random = (stream: number) => hash(slabKey.add(stream * 1_048_573))
    const edgeWobble = mx_noise_float(vec3(worldXZ.mul(16), random(1).mul(20))).mul(0.0012).mul(jointDetail)
    const edge = rawEdge.sub(edgeWobble).toVar('forgeFloorEdge')
    const stoneMask = mix(float(0.95), insideBy(float(halfJoint).sub(edge), footprint), jointDetail).toVar('forgeFloorStoneMask')
    const top = normalWorldGeometry.y.step(0.5)
    const finish = reflections ? roughness : roughness + 0.16
    super(null, {
      color: '#ffffff',
      roughness: finish,
      reflection: reflections ? {
        strength,
        grazingStrength,
        loss,
        gaussianBlur,
        mask: top.mul(stoneMask),
      } : undefined,
    })
    this.name = 'Forge basalt floor'
    // Varied dark basalt & Belgian bluestone slab tones (field slightly richer, border deeper)
    const pick = random(2)
    const shade = random(3).sub(0.5).mul(0.12).add(1)
    const fieldTone = select(
      pick.lessThan(0.28),
      color('#3d4044'),
      select(
        pick.lessThan(0.56),
        color('#484642'),
        select(
          pick.lessThan(0.8),
          color('#414449'),
          color('#4e4942'),
        ),
      ),
    ).mul(shade)
    const borderTone = mix(color('#313337'), color('#3c3a38'), pick).mul(shade)
    const slabBase = mix(fieldTone, borderTone, inBorder)
    // Natural honed basalt mineral clouding, fine grain and subtle quartz micro-flecks
    const seed = random(4).mul(60)
    const cloud = unit(mx_fractal_noise_float(vec3(worldXZ.mul(1.2), seed), 3, 2.1, 0.5))
    const grain = mix(float(0.5), unit(mx_noise_float(vec3(worldXZ.mul(55), seed.add(3)))), fineDetail)
    const flecks = unit(mx_noise_float(vec3(worldXZ.mul(145), seed.add(7)))).smoothstep(0.84, 0.96).mul(fineDetail).mul(0.2)
    const stone = mix(slabBase.mul(cloud.sub(0.5).mul(0.14).add(grain.sub(0.5).mul(0.07)).add(1)), color('#7e7b74'), flecks)
    // Subtle aisle polishing darkens the honed stone a whisper and lowers roughness
    const wornStone = stone.mul(aisleWear.mul(-0.05).add(1))
    const shoulder = edge.sub(halfJoint).div(0.008).clamp(0, 1).smoothstep(0, 1)
    const mortar = color('#212121').mul(grain.sub(0.5).mul(0.12).add(1))
    const topSurface = mix(mortar, wornStone.mul(shoulder.mul(0.1).add(0.9)), stoneMask)
    this.colorNode = mix(color('#2d2e30'), topSurface, top)
    // Honed slabs vary gently in sheen; aisle is smoother; mortar joints stay very matte
    const slabRough = float(finish).add(cloud.sub(0.5).mul(0.08)).add(random(5).sub(0.5).mul(0.06)).sub(aisleWear.mul(0.1)).clamp(0.28, 0.78)
    this.roughnessNode = mix(float(0.92), slabRough, stoneMask)
    // Subtle flagstone tilt, slight beveled joint shoulder and fine stone waviness
    const waviness = mx_noise_float(vec3(worldXZ.mul(3.4), seed.add(21))).mul(0.00025).mul(fineDetail)
    const jointHeight = mix(float(-0.0018), shoulder.mul(0.0008).add(waviness), shoulder).mul(jointDetail)
    this.normalNode = heightNormal(jointHeight.mul(top))
  }
}
