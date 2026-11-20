import type {AnalyticLightNode, Light, LightingNode, NodeBuilder} from 'three/webgpu'

import {Lighting, LightsNode, NodeUtils, PointLight} from 'three/webgpu'

import {shadowPool} from '#src/lib/rendering/shadowPool.ts'

import PointLightsNode from './PointLightsNode.ts'
import ShiningLightNode from './ShiningLightNode.ts'

type Batch = 'point'

// Uniform arrays have a fixed length per build; the gallery has about 50 shadowless point lights.
const capacity = 128
/** The batch that shades a light, if any. Shadow casters and every other kind of light keep a node of their own. */
const batchOf = (light: Light): Batch | undefined => {
  if (light.castShadow) {
    return undefined
  }
  return light.constructor === PointLight ? 'point' : undefined
}
/** Whether a light node shades a point or spot light that casts a shadow, whose code costs the most per fragment and which may stay dark for long, like an idle slot of the shadow pool. */
const isDimmable = (node: LightingNode): node is AnalyticLightNode<Light> => {
  const {light} = node as Partial<AnalyticLightNode<Light & {
    isPointLight?: boolean
    isSpotLight?: boolean
  }>>
  return Boolean(light?.castShadow && (light.isPointLight || light.isSpotLight))
}
/** one wrapper per light node, so that every material shares its build */
const shining = new WeakMap<AnalyticLightNode<Light>, ShiningLightNode>
const shine = (node: AnalyticLightNode<Light>) => {
  let wrapper = shining.get(node)
  if (!wrapper) {
    wrapper = new ShiningLightNode(node)
    shining.set(node, wrapper)
  }
  return wrapper
}

/**
 * Lights materials like {@link LightsNode}, but shades shadowless point lights in one loop through {@link PointLightsNode}, and skips the lighting and shadows of dark shadow-casting point and spot lights through {@link ShiningLightNode}.
 *
 * Batched lights also stay out of the cache key: the batches read their members every frame, so lights can move, mount and unmount without rebuilding any material, as long as their batch already exists.
 */
export default class BatchedLightsNode extends LightsNode {
  private readonly batches = new Map<Batch, PointLightsNode>
  private readonly own: Array<Light> = []

  /** Sets up the loop for a batch, if not done yet. */
  protected addBatch(batch: Batch) {
    if (!this.batches.has(batch)) {
      this.batches.set(batch, new PointLightsNode(capacity, () => this.membersOf(batch)))
    }
  }

  // The batched lights belong to this instance’s uniform arrays, so materials lit by another lights node must not share its builds.
  override customCacheKey() {
    return NodeUtils.hashArray([super.customCacheKey(), this.id, this.batches.size])
  }

  override getBuiltinLights() {
    return this.own
  }

  /** The lights the batches read every frame. */
  protected liveLights(): Iterable<Light> {
    return this.getLights()
  }

  override setLights(lights: Array<Light>) {
    super.setLights(lights)
    this.own.length = 0
    for (const light of lights) {
      const batch = batchOf(light)
      if (batch) {
        this.addBatch(batch)
      } else {
        this.own.push(light)
      }
    }
    return this
  }

  override setupLightsNode(builder: NodeBuilder) {
    const nodes = super.setupLightsNode(builder)
    // The dimmable lights come last, so what every light needs, like the view direction, is computed before their branches and reused inside: a value a branch computes first only lives inside it, and the code after it computes it again.
    return [...nodes.filter(node => !isDimmable(node)), ...this.batches.values(), ...nodes.filter(isDimmable).map(shine)]
  }

  private *membersOf(batch: Batch) {
    for (const light of this.liveLights()) {
      // A light lent a shadow slot is shaded by the slot instead.
      if (batchOf(light) === batch && !shadowPool.isLent(light)) {
        yield light as PointLight
      }
    }
  }
}

/** Gives every scene a {@link BatchedLightsNode}. */
export class BatchedLighting extends Lighting {
  override createNode(lights: Array<Light> = []) {
    const node = new BatchedLightsNode
    return node.setLights(lights)
  }
}
