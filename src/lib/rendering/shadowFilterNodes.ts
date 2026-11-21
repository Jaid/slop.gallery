import type Node from 'three/src/nodes/core/Node.js'
import type {CubeTexture, LightShadow, NodeBuilder, Renderer, Texture} from 'three/webgpu'

import {abs, cross, cubeTexture, float, Fn, int, interleavedGradientNoise, Loop, max, normalize, reference, renderGroup, screenCoordinate, texture, vec3, viewZToLogarithmicDepth, vogelDiskSample} from 'three/tsl'

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
function createPointShadowFilter(count: number) {
  return Fn((inputs: PointShadowFilterInputs, builder: NodeBuilder) => {
    const sample = pointShadowSampler(inputs, builder.renderer)
    const phi = rotation()
    return average(Array.from({length: count}, (_, index) => sample(vogelDiskSample(int(index), int(count), phi))))
  })
}
/**
 * Like {@link createPcfShadowFilter} and {@link createPointShadowFilter}, but looping over `shadow.filterSamples` lookups, a uniform the tuning panel changes live: three builds a light’s shadow with its filter only once.
 */
function createTunableShadowFilter(isPoint: boolean) {
  return Fn((inputs: PointShadowFilterInputs & ShadowFilterInputs, builder: NodeBuilder) => {
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
  })
}
export const tunableFilters = {
  pcf: createTunableShadowFilter(false),
  point: createTunableShadowFilter(true),
}
/** Three’s own filters take this many samples. */
const defaultSamples = 5
const filters = new Map<string, ReturnType<typeof createPcfShadowFilter> | ReturnType<typeof createPointShadowFilter>>
const getFilter = (count: number, isPoint: boolean) => {
  const key = `${isPoint ? 'point' : 'pcf'}:${count}`
  let filter = filters.get(key)
  if (!filter) {
    filter = isPoint ? createPointShadowFilter(count) : createPcfShadowFilter(count)
    filters.set(key, filter)
  }
  return filter
}

/** Shadow props for a map of `mapSize` texels along each axis, filtered by `samples` lookups on a disk of `radius` texels. */
export function getShadowProps({isPoint = false, mapSize, radius, samples}: {
  isPoint?: boolean
  mapSize: number
  radius: number
  samples: number
}) {
  return {
    'shadow-filterNode': samples === defaultSamples ? null : getFilter(samples, isPoint),
    'shadow-mapSize': [mapSize, mapSize] as const,
    'shadow-radius': radius,
  }
}
