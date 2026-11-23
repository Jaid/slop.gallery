import type {SoftShadow} from '../../src/lib/rendering/shadowFilterNodes.ts'

import {BoxGeometry, DataUtils, DoubleSide, HalfFloatType, Mesh, MeshStandardNodeMaterial, PCFShadowMap, PerspectiveCamera, PointLight, RenderTarget, Scene, WebGPURenderer} from 'three/webgpu'

import portalShadow from '../../src/lib/gallery/fusion/portalShadow.ts'
import {getShadowProps, softenShadow} from '../../src/lib/rendering/shadowFilterNodes.ts'

const size = 384
/** three’s own 5-tap filter, the gallery’s at heavy’s and cinematic’s sample counts, and the shadow pool’s softenable one blurring as wide as a fusion portal’s shadows, with how much of the room each may darken at most, by default twice three’s */
const variants: Array<{
  /** the share of the directly lit room it may darken */
  limit?: number
  name: string
  samples: number | null
  soft?: Partial<SoftShadow>
}> = [
  {
    name: 'three',
    samples: null,
  },
  {
    name: 'heavy',
    samples: 4,
  },
  {
    name: 'cinematic',
    samples: 16,
  },
  {
    // The room’s corners shade each other along the corner, about 5% of it at the portal’s 3° (3% at 2°). Three’s filter 2° wide, comparing against the fragment’s distance, darkened 76%, as every wall and the floor shaded themselves.
    limit: 0.06,
    name: 'fusion',
    samples: 4,
    soft: portalShadow,
  },
]
const views: Array<{
  position: [number, number, number]
  target: [number, number, number]
}> = [
  {
    position: [-1.2, -0.4, 1.4],
    target: [3, 2, -3],
  },
  {
    position: [1.4, 0.2, 1.2],
    target: [-3, -2, -3],
  },
  {
    position: [0, 0, 0],
    target: [3, 0.1, 3],
  },
]

/**
 * Standalone: a closed, double-sided room lit only by a shadow-casting point light inside it, like a lamp in a gallery room. Every surface sees the light directly, so the shadowed render must match the same render at shadow intensity 0. Before the gallery’s point filters compared each sample against the depth of its own cube face, they darkened seams where the cube’s faces meet.
 * The softened filter blurs over far more of the map, where comparing against the fragment’s distance would let the room’s own walls and floor shade themselves wherever they come nearer the light.
 */
export default async function verifyPointShadowSeams() {
  const renderer = new WebGPURenderer({canvas: document.createElement('canvas')})
  const target = new RenderTarget(size, size, {type: HalfFloatType})
  const geometry = new BoxGeometry(6, 4, 6)
  const errors: Array<string> = []
  const results = []
  try {
    await renderer.init()
    const {device} = renderer.backend as typeof renderer.backend & {device: GPUDevice}
    device.addEventListener('uncapturederror', event => errors.push(event.error.message))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap
    renderer.setRenderTarget(target)
    const camera = new PerspectiveCamera(100, 1, 0.05, 20)
    for (const {limit, name, samples, soft} of variants) {
      const scene = new Scene
      const material = new MeshStandardNodeMaterial({
        color: '#bbbbbb',
        roughness: 1,
        side: DoubleSide,
      })
      const room = new Mesh(geometry, material)
      room.castShadow = true
      room.receiveShadow = true
      // The gallery’s shadow slots: a near plane of 0.1, a normal bias of 3.5 cm and no depth bias.
      const light = new PointLight('#ffffff', 30, 12, 2)
      light.position.set(0.7, 0.4, -0.3)
      light.castShadow = true
      light.shadow.camera.near = 0.1
      light.shadow.camera.far = 12
      light.shadow.normalBias = 0.035
      if (samples !== null) {
        const props = getShadowProps({
          isPoint: true,
          mapSize: 512,
          radius: 4,
          samples,
          softenable: soft !== undefined,
        })
        if (soft) {
          softenShadow(light.shadow, soft)
        }
        // The filter node the gallery’s lights get through their `shadow-filterNode` prop, which three reads untyped.
        Object.assign(light.shadow, {filterNode: props['shadow-filterNode']})
        light.shadow.mapSize.fromArray(props['shadow-mapSize'])
        light.shadow.radius = props['shadow-radius']
      } else {
        light.shadow.mapSize.set(512, 512)
        light.shadow.radius = 4
      }
      scene.add(room, light)
      const read = async () => {
        renderer.render(scene, camera)
        const raw = await renderer.readRenderTargetPixelsAsync(target, 0, 0, size, size) as Uint16Array
        return Float32Array.from(raw, value => DataUtils.fromHalfFloat(value))
      }
      let darkened = 0
      let pixels = 0
      let worst = 1
      for (const view of views) {
        camera.position.fromArray(view.position)
        camera.lookAt(...view.target)
        light.shadow.intensity = 1
        light.shadow.needsUpdate = true
        const shadowed = await read()
        light.shadow.intensity = 0
        const lit = await read()
        for (let i = 0; i < lit.length; i += 4) {
          const reference = lit[i] + lit[i + 1] + lit[i + 2]
          const value = shadowed[i] + shadowed[i + 1] + shadowed[i + 2]
          assert(Number.isFinite(value) && Number.isFinite(reference), `${name}: non-finite pixels`)
          if (reference < 1e-3) {
            continue
          }
          pixels++
          const ratio = value / reference
          worst = Math.min(worst, ratio)
          if (ratio < 0.97) {
            darkened++
          }
        }
      }
      results.push({
        limit,
        name,
        darkenedFraction: darkened / pixels,
        worstRatio: worst,
      })
      material.dispose()
      light.dispose()
    }
    await device.queue.onSubmittedWorkDone()
    assert(errors.length === 0, errors.join('\n'))
    const [reference, ...others] = results
    for (const {darkenedFraction, limit = Math.max(0.001, reference.darkenedFraction * 2), name} of others) {
      assert(darkenedFraction <= limit, `${name}: ${(darkenedFraction * 100).toFixed(2)}% of the directly lit room is darkened by its own shadow, at most ${(limit * 100).toFixed(2)}% allowed, three’s filter ${(reference.darkenedFraction * 100).toFixed(2)}%`)
    }
    return {results}
  } finally {
    renderer.setRenderTarget(null)
    geometry.dispose()
    target.dispose()
    await renderer.dispose()
  }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}
