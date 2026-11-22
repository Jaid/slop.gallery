import type Node from 'three/src/nodes/core/Node.js'
import type {CubeTexture, LightShadow, NodeBuilder, Renderer, Texture} from 'three/webgpu'

import {abs, cross, cubeTexture, float, Fn, frameId, If, int, interleavedGradientNoise, Loop, max, normalize, normalWorld, reference, renderGroup, screenCoordinate, select, texture, uint, vec3, viewZToLogarithmicDepth, vogelDiskSample} from 'three/tsl'

type ShadowFilterInputs = {
  depthLayer?: Node<'int'>
  depthTexture: Texture & {isArrayTexture?: boolean}
  shadow: LightShadow
  shadowCoord: Node<'vec3'>
}
type PointShadowFilterInputs = {
  bd3D: Node<'vec3'>
  depthTexture: CubeTexture
  /** the distance from the light to the fragment */
  distance: Node<'float'>
  shadow: LightShadow
}

const average = (samples: Array<Node<'float'>>) => samples.reduce((sum, sample) => sum.add(sample)).div(samples.length)
/** the per-pixel rotation of the sampling disk, which the temporal resolve averages out */
const rotation = () => interleavedGradientNoise(screenCoordinate.xy).mul(Math.PI * 2)
/**
 * Compares the point light shadow cube map against the fragment once per offset on a disk around its direction, like three’s own point filter.
 *
 * Each face of the cube stores the depth along its own axis, so every sample compares against the depth its own face stores for a point at the fragment’s distance in the sample’s direction. A single depth for all of them, taken on the fragment’s face, leaves seams where the faces meet on surfaces the light also shades, like double-sided walls.
 */
function pointShadowSampler({bd3D, depthTexture, distance, shadow}: PointShadowFilterInputs, renderer: Renderer) {
  const spread = reference('radius', 'float', shadow).div(reference('mapSize', 'vec2', shadow).x).toConst()
  // a tangent frame around the direction to offset the samples in
  const absolute = abs(bd3D)
  const tangent = normalize(cross(bd3D, absolute.x.greaterThan(absolute.z).select(vec3(0, 1, 0), vec3(1, 0, 0)))).toConst()
  const bitangent = cross(bd3D, tangent).toConst()
  const near = reference('near', 'float', shadow.camera).setGroup(renderGroup)
  const far = reference('far', 'float', shadow.camera).setGroup(renderGroup)
  const bias = reference('bias', 'float', shadow).setGroup(renderGroup)
  // three’s getPointShadowDepthFn: perspective depth is depthA + depthB / max(|x|, |y|, |z|) of the direction, so everything but the division is shared.
  let depthAt: (maxAbs: Node<'float'>) => Node<'float'>
  if (renderer.logarithmicDepthBuffer) {
    depthAt = maxAbs => viewZToLogarithmicDepth(maxAbs.mul(distance).negate(), near, far).add(bias)
  } else {
    const range = far.sub(near)
    const nearFar = near.mul(far).div(range.mul(distance))
    const depthA = (renderer.reversedDepthBuffer ? near.div(range).add(bias).negate() : far.div(range).add(bias)).toConst()
    const depthB = (renderer.reversedDepthBuffer ? nearFar : nearFar.negate()).toConst()
    depthAt = maxAbs => depthA.add(depthB.div(maxAbs))
  }
  return (offset: Node<'vec2'>) => {
    const direction = bd3D.add(tangent.mul(offset.x).add(bitangent.mul(offset.y)).mul(spread)).toConst()
    const directionAbsolute = abs(direction).toConst()
    return cubeTexture(depthTexture, direction).compare(depthAt(max(directionAbsolute.x, directionAbsolute.y, directionAbsolute.z))) as unknown as Node<'float'>
  }
}
/**
 * Three’s PCF filter for directional and spot lights with any number of samples instead of 5, on the same Vogel disk of `shadow.radius` texels.
 *
 * More samples resolve the penumbra’s gradient in a single frame instead of leaving noise for the temporal resolve.
 */
function createPcfShadowFilter(count: number) {
  return Fn(({depthLayer, depthTexture, shadow, shadowCoord}: ShadowFilterInputs) => {
    const mapSize = reference('mapSize', 'vec2', shadow)
    const radius = reference('radius', 'float', shadow)
    const spread = radius.div(mapSize.x)
    const phi = rotation()
    return average(Array.from({length: count}, (_, index) => {
      let depth = texture(depthTexture, shadowCoord.xy.add(vogelDiskSample(int(index), int(count), phi).mul(spread)))
      if (depthTexture.isArrayTexture) {
        depth = depth.depth(depthLayer!)
      }
      return depth.compare(shadowCoord.z) as unknown as Node<'float'>
    }))
  })
}
/** Three’s point light shadow filter with any number of samples instead of 5, see {@link createPcfShadowFilter} and {@link pointShadowSampler}. */
const pointShadowFilter = (count: number) => (inputs: PointShadowFilterInputs, builder: NodeBuilder) => {
  const sample = pointShadowSampler(inputs, builder.renderer)
  const phi = rotation()
  return average(Array.from({length: count}, (_, index) => sample(vogelDiskSample(int(index), int(count), phi))))
}
/**
 * Like {@link createPcfShadowFilter} and {@link pointShadowFilter}, but looping over `shadow.filterSamples` lookups, a uniform the tuning panel changes live: three builds a light’s shadow with its filter only once.
 */
const tunableShadowFilter = (isPoint: boolean) => (inputs: PointShadowFilterInputs & ShadowFilterInputs, builder: NodeBuilder) => {
  const {depthLayer, depthTexture, shadow} = inputs
  const count = reference('filterSamples', 'int', shadow)
  const phi = rotation()
  const sum = float(0).toVar()
  if (isPoint) {
    const sample = pointShadowSampler(inputs, builder.renderer)
    Loop(count, ({i}) => {
      sum.addAssign(sample(vogelDiskSample(i, count, phi)))
    })
  } else {
    const spread = reference('radius', 'float', shadow).div(reference('mapSize', 'vec2', shadow).x)
    const {shadowCoord} = inputs
    Loop(count, ({i}) => {
      let depth = texture(depthTexture, shadowCoord.xy.add(vogelDiskSample(i, count, phi).mul(spread)))
      if (depthTexture.isArrayTexture) {
        depth = depth.depth(depthLayer!)
      }
      sum.addAssign(depth.compare(shadowCoord.z))
    })
  }
  return sum.div(float(count))
}
/** What a softenable point light shadow blurs by, which its filter reads as uniforms, so it can change from frame to frame without building anything anew. */
export type SoftShadow = {
  /** the angular radius of a wide blur of the same width everywhere, in radians, or 0 to blur as its filter always does */
  blurAngle: number
  /** lookups per pixel of the wide blur */
  softSamples: number
}

/** Fills in what a softenable shadow blurs by, blurring as its filter always did. */
export function softenShadow(shadow: LightShadow, soft: Partial<SoftShadow> = {}) {
  return Object.assign<LightShadow, SoftShadow, Partial<SoftShadow>>(shadow, {
    blurAngle: 0,
    softSamples: 16,
  }, soft)
}
/** how much nearer than the fragment’s surface a lookup must find something to take it for what casts the shadow, per meter its lookups spread out from the fragment */
const softSlack = 0.15
/** the per-pixel rotation of the sampling disk, turning on from frame to frame, so the temporal resolve averages the wide blur out */
const turningRotation = () => interleavedGradientNoise(screenCoordinate.xy.add(float(frameId.mod(uint(64))).mul(5.588238))).mul(Math.PI * 2)
/**
 * The share of `count` point light shadow lookups spread by the tangent of an angle round the direction to the fragment that nothing shades, for blurs much wider than three’s filter takes.
 *
 * Each lookup compares against the fragment’s own surface, a plane through it, where the lookup’s ray meets it, and never farther than the fragment. A wide blur comparing every lookup against the fragment’s distance would take the surface itself for what casts the shadow wherever it comes nearer the light, like a floor under a lamp, and darken it. Surfaces meeting the fragment’s in a corner still shade it a little along the corner, which looks like a contact shadow there.
 */
function softPointBlur({bd3D, depthTexture, distance, shadow}: PointShadowFilterInputs, renderer: Renderer, count: Node<'int'>, spread: Node<'float'>) {
  const absolute = abs(bd3D)
  const tangent = normalize(cross(bd3D, absolute.x.greaterThan(absolute.z).select(vec3(0, 1, 0), vec3(1, 0, 0)))).toConst()
  const bitangent = cross(bd3D, tangent).toConst()
  const near = reference('near', 'float', shadow.camera).setGroup(renderGroup)
  const far = reference('far', 'float', shadow.camera).setGroup(renderGroup)
  const bias = reference('bias', 'float', shadow).setGroup(renderGroup)
  const range = far.sub(near).toConst()
  const nearFar = near.mul(far).toConst()
  const normal = normalize(normalWorld).toConst()
  const facing = normal.dot(bd3D).toConst()
  const slack = spread.mul(distance).mul(softSlack).toConst()
  const phi = turningRotation()
  const sum = float(0).toVar()
  Loop(count, ({i}) => {
    const offset = vogelDiskSample(i, count, phi)
    const ray = bd3D.add(tangent.mul(offset.x).add(bitangent.mul(offset.y)).mul(spread)).toConst()
    const unit = normalize(ray).toConst()
    // where the ray meets the fragment’s surface, no farther than the fragment; only surfaces facing the light have one
    const along = normal.dot(unit)
    const surface = select(facing.lessThan(0).and(along.lessThan(facing)), distance.mul(facing).div(along), distance)
    // Each face of the cube stores perspective depth along its own axis.
    const rayAbsolute = abs(unit)
    const axial = surface.sub(slack).mul(max(rayAbsolute.x, rayAbsolute.y, rayAbsolute.z))
    const depth = renderer.reversedDepthBuffer ? nearFar.div(range.mul(axial)).sub(near.div(range)).sub(bias) : far.div(range).add(bias).sub(nearFar.div(range.mul(axial)))
    sum.addAssign(cubeTexture(depthTexture, ray).compare(depth))
  })
  return sum.div(float(count))
}
/**
 * A point light shadow filter that blurs as `filter` does, or by a wide blur of the same width everywhere while the shadow’s `blurAngle` is above 0, see {@link softenShadow}.
 * The choice is a uniform branch, so a light not softened only pays for it in the size of every lit material’s shader.
 */
function createSoftenablePointFilter(filter: (inputs: PointShadowFilterInputs & ShadowFilterInputs, builder: NodeBuilder) => Node<'float'>) {
  return Fn((inputs: PointShadowFilterInputs & ShadowFilterInputs, builder: NodeBuilder) => {
    const {renderer} = builder
    if (renderer.logarithmicDepthBuffer) {
      return filter(inputs, builder)
    }
    const {shadow} = inputs
    const blurAngle = reference('blurAngle', 'float', shadow).setGroup(renderGroup)
    const count = reference('softSamples', 'int', shadow).setGroup(renderGroup)
    const sharpest = reference('radius', 'float', shadow).div(reference('mapSize', 'vec2', shadow).x)
    const result = float(1).toVar()
    If(blurAngle.greaterThan(0), () => {
      result.assign(softPointBlur(inputs, renderer, count, blurAngle.tan().max(sharpest)))
    }).Else(() => {
      result.assign(filter(inputs, builder))
    })
    return result
  })
}

export const tunableFilters = {
  pcf: Fn(tunableShadowFilter(false)),
  point: Fn(tunableShadowFilter(true)),
  softPoint: createSoftenablePointFilter(tunableShadowFilter(true)),
}
/** Three’s own filters take this many samples. */
const defaultSamples = 5
const filters = new Map<string, ReturnType<typeof createPcfShadowFilter> | ReturnType<typeof createSoftenablePointFilter>>
const getFilter = (count: number, isPoint: boolean, softenable: boolean) => {
  const key = `${isPoint ? 'point' : 'pcf'}:${count}${softenable ? ':soft' : ''}`
  let filter = filters.get(key)
  if (!filter) {
    if (softenable) {
      filter = createSoftenablePointFilter(pointShadowFilter(count))
    } else {
      filter = isPoint ? Fn(pointShadowFilter(count)) : createPcfShadowFilter(count)
    }
    filters.set(key, filter)
  }
  return filter
}

/** Shadow props for a map of `mapSize` texels along each axis, filtered by `samples` lookups on a disk of `radius` texels, or, for a `softenable` point light, wider as its shadow says, see {@link softenShadow}. */
export function getShadowProps({isPoint = false, mapSize, radius, samples, softenable = false}: {
  isPoint?: boolean
  mapSize: number
  radius: number
  samples: number
  softenable?: boolean
}) {
  const soft = softenable && isPoint
  return {
    'shadow-filterNode': samples === defaultSamples && !soft ? null : getFilter(samples, isPoint, soft),
    'shadow-mapSize': [mapSize, mapSize] as const,
    'shadow-radius': radius,
  }
}
