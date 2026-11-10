import {Box3, DataUtils, HalfFloatType, InstancedMesh, Mesh, OrthographicCamera, RenderTarget, Scene, Vector3, WebGPURenderer} from 'three/webgpu'

import StudioEnvironment from '../../packages/knot-materials/src/StudioEnvironment.ts'
import createSupportGeometry from '../../src/components/KnotLabels/supportGeometry.ts'
import OculusRailing from '../../src/lib/gallery/railings/OculusRailing.ts'
import PolylineTubeGeometry from '../../src/lib/gallery/railings/PolylineTubeGeometry.ts'
import SlattedBenchGeometry from '../../src/lib/gallery/SlattedBenchGeometry.ts'
import BrushedMetalMaterial from '../../src/lib/materials/BrushedMetalMaterial.ts'

/** Standalone, detached HDR readback: real meshes, no scene lights or environment to hide missing pseudo-reflections. */
export default async function verifyBrushedMetal() {
  const renderer = new WebGPURenderer({canvas: document.createElement('canvas')})
  const target = new RenderTarget(256, 256, {type: HalfFloatType})
  const environment = new StudioEnvironment
  const material = new BrushedMetalMaterial({environment})
  const bench = new SlattedBenchGeometry
  const path = new OculusRailing('east')
  // The actual curved section in the issue, not a straight cylinder stand-in.
  const points = path.points.slice(-16)
  const rail = new PolylineTubeGeometry(points, path.radius, 12)
  const support = createSupportGeometry()
  const geometries = [bench.metal, rail, support]
  const instanced = new InstancedMesh(support, material, 1)
  const errors: Array<string> = []
  const results = []
  try {
    await renderer.init()
    const {device} = renderer.backend as typeof renderer.backend & {device: GPUDevice}
    device.addEventListener('uncapturederror', event => errors.push(event.error.message))
    renderer.setClearColor(0, 0)
    renderer.setRenderTarget(target)
    const scene = new Scene
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 200)
    const read = async () => {
      renderer.render(scene, camera)
      const raw = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 256, 256) as Uint16Array
      return Float32Array.from(raw, value => DataUtils.fromHalfFloat(value))
    }
    const summarize = (pixels: Float32Array, name: string) => {
      const luminance: Array<number> = []
      for (let i = 0; i < pixels.length; i += 4) {
        assert(pixels.subarray(i, i + 4).every(value => Number.isFinite(value) && value >= 0), 'Steel produced invalid HDR pixels.')
        if (pixels[i + 3] > 0.9) {
          luminance.push(pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722)
        }
      }
      assert(luminance.length >= 32, `${name}: steel rendered only ${luminance.length} visible pixels.`)
      luminance.sort((a, b) => a - b)
      const percentile = (p: number) => luminance[Math.floor((luminance.length - 1) * p)]
      assert(luminance[0] > 0.001, 'Steel has black sectors without scene lighting.')
      assert(percentile(0.98) < 1.2, 'Steel has excessively bright broad highlights.')
      return {
        visible: luminance.length,
        low: percentile(0.1),
        high: percentile(0.9),
      }
    }
    for (const [index, geometry] of geometries.entries()) {
      // No tangent/UV dependency: the same shader must work on merged and custom tube geometry.
      geometry.deleteAttribute('uv')
      const mesh = new Mesh(geometry, material)
      scene.add(mesh)
      const box = new Box3
      box.setFromObject(mesh)
      const center = box.getCenter(new Vector3)
      const radius = box.getSize(new Vector3).length() / 2
      const readings = []
      for (const distance of [1, 3]) {
        const span = radius * distance
        Object.assign(camera, {
          top: span,
          bottom: -span,
          left: -span,
          right: span,
        })
        camera.updateProjectionMatrix()
        for (const angle of [0.2, 1.2, 2.4, 4.1]) {
          const direction = new Vector3(Math.sin(angle), 0.45, Math.cos(angle))
          camera.position.copy(center).addScaledVector(direction, radius * 3)
          camera.lookAt(center)
          const stats = summarize(await read(), `${index}:${distance}:${angle}`)
          readings.push(stats)
        }
      }
      assert(readings.some(stats => stats.high > stats.low * 1.5), 'Steel has no light/dark reflection structure.')
      results.push({
        geometry: ['bench', 'rail', 'support'][index],
        readings,
      })
      scene.remove(mesh)
    }
    // Instanced and ordinary nameplate supports must agree, including after grabbing/moving one far from the origin.
    const mesh = new Mesh(support, material)
    mesh.rotation.set(0.24, 0.43, -0.12)
    mesh.updateMatrix()
    instanced.setMatrixAt(0, mesh.matrix)
    instanced.instanceMatrix.needsUpdate = true
    Object.assign(camera, {
      top: 0.6,
      bottom: -0.6,
      left: -0.6,
      right: 0.6,
    })
    camera.updateProjectionMatrix()
    camera.position.set(1, 0.2, -2)
    camera.lookAt(0, -0.3, 0)
    scene.add(mesh)
    const ordinary = await read()
    scene.remove(mesh)
    scene.add(instanced)
    const batch = await read()
    scene.remove(instanced)
    const offset = new Vector3(11.5, -4.25, 7.75)
    mesh.position.copy(offset)
    camera.position.add(offset)
    scene.add(mesh)
    const moved = await read()
    const difference = (other: Float32Array) => {
      let error = 0
      let energy = 0
      for (const [i, element] of ordinary.entries()) {
        error += Math.abs(element - other[i])
        energy += element
      }
      return error / energy
    }
    const instancedError = difference(batch)
    const movedError = difference(moved)
    assert(instancedError < 0.01, `Instancing changed steel shading: ${instancedError}`)
    assert(movedError < 0.01, `Steel grain swims when the object moves: ${movedError}`)
    await device.queue.onSubmittedWorkDone()
    assert(errors.length === 0, errors.join('\n'))
    return {
      results,
      instancedError,
      movedError,
      errors,
    }
  } finally {
    renderer.setRenderTarget(null)
    instanced.dispose()
    bench.dispose()
    rail.dispose()
    support.dispose()
    material.dispose()
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
