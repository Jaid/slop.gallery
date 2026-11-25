import type {NodeFrame} from 'three/webgpu'

import hsl from 'okhsl'
import {AmbientLight, HalfFloatType, HemisphereLight, PerspectiveCamera, RenderTarget, Scene, WebGPURenderer} from 'three/webgpu'

import createKnotMesh from '../../packages/knot-materials/src/createKnotMesh.ts'
import Prince from '../../packages/knot-materials/src/entries/knotty_prince/Material.ts'
import {createKnotGeometry} from '../../packages/knot-materials/src/geometry.ts'
import StudioEnvironment from '../../packages/knot-materials/src/StudioEnvironment.ts'

/** Keep every opaque-core pixel covered while retaining shell-only fuzz. Uses the original sculpt and alpha mask. */
export default async function verifyKnottyPrince(samples = 4) {
  const renderer = new WebGPURenderer({
    canvas: document.createElement('canvas'),
    alpha: true,
  })
  const environment = new StudioEnvironment
  const geometry = createKnotGeometry()
  const material = new Prince(environment)
  const mesh = createKnotMesh(geometry, material)
  const core = mesh.children[0]
  const target = new RenderTarget(512, 512, {type: HalfFloatType})
  target.samples = samples
  const scene = new Scene
  scene.add(mesh, new AmbientLight(hsl.integer(0, 0, 100), 0.45), new HemisphereLight(hsl.integer(258, 100, 93), hsl.integer(72, 20, 48), 1.3))
  const camera = new PerspectiveCamera(40, 1, 0.05, 100)
  const errors: Array<string> = []
  const results = []
  let originalGaps = 0
  let retainedFuzz = 0
  try {
    await renderer.init()
    const offline = renderer as WebGPURenderer & {
      _animation: {stop: () => void}
      _nodes: {nodeFrame: NodeFrame}
    }
    offline._animation.stop()
    const {device} = renderer.backend as typeof renderer.backend & {device: GPUDevice}
    device.addEventListener('uncapturederror', event => errors.push(event.error.message))
    renderer.setClearColor(0, 0)
    renderer.setRenderTarget(target)
    const read = async () => {
      renderer.render(scene, camera)
      const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 512, 512) as Uint16Array
      assert(!pixels.some(value => (value & 0x7C_00) === 0x7C_00), 'Non-finite HDR pixels')
      return pixels
    }
    for (const seconds of [0.4, 0.94, 1.8]) {
      for (const distance of [1.7, 2.6]) {
        for (const angle of [0.3, 1.1, 2.2, 3.4]) {
          offline._nodes.nodeFrame.frameId++
          offline._nodes.nodeFrame.time = seconds
          camera.position.set(Math.sin(angle) * distance, 0.1, Math.cos(angle) * distance)
          camera.lookAt(0, 0, 0)
          // Original creator's outer mesh and mask, without a solid interior.
          core.visible = false
          const shell = await read()
          // Same topology, same anatomy, only the fuzz-thickness offset removed.
          mesh.material = material.coreMaterial!
          const solid = await read()
          mesh.material = material
          core.visible = true
          const complete = await read()
          let checked = 0
          let gaps = 0
          for (let i = 3; i < solid.length; i += 4) {
            if (solid[i]) {
              checked++
              if (!shell[i]) {
                originalGaps++
              }
              if (!complete[i]) {
                gaps++
              }
            } else if (complete[i]) {
              retainedFuzz++
            }
          }
          assert(checked > 1000, 'Empty solid-core render')
          assert(gaps === 0, `${gaps} core pixels remained see-through`)
          results.push({
            seconds,
            distance,
            angle,
            checked,
            gaps,
          })
        }
      }
    }
    await device.queue.onSubmittedWorkDone()
    assert(originalGaps > 100, 'Fixture did not reproduce the original slices')
    assert(retainedFuzz > 100, 'The frayed outer shell was lost')
    assert(errors.length === 0, errors.join('\n'))
    return {
      results,
      originalGaps,
      retainedFuzz,
      errors,
    }
  } finally {
    renderer.setRenderTarget(null)
    material.dispose()
    geometry.dispose()
    environment.dispose()
    target.dispose()
    await renderer.dispose()
  }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}
