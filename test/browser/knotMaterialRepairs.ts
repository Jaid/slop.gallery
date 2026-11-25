import hsl from 'okhsl'
import {positionGeometry, vec3} from 'three/tsl'
import {AmbientLight, DataUtils, DirectionalLight, HalfFloatType, HemisphereLight, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PerspectiveCamera, PlaneGeometry, RenderTarget, Scene, WebGPURenderer} from 'three/webgpu'

import {studioRadiance} from '../../packages/knot-materials/src/candidates/space_bunny/lib/studio.ts'
import AmberVigil from '../../packages/knot-materials/src/entries/amber_vigil/Material.ts'
import MoireVespers from '../../packages/knot-materials/src/entries/moire_vespers/Material.ts'
import RimeCathedral from '../../packages/knot-materials/src/entries/rime_cathedral/Material.ts'
import {createKnotGeometry} from '../../packages/knot-materials/src/geometry.ts'
import StudioEnvironment from '../../packages/knot-materials/src/StudioEnvironment.ts'

/** Detached HDR readback catches black sectors as well as non-finite pixels; no live-game interaction. */
export default async function verifyKnotMaterialRepairs() {
  const renderer = new WebGPURenderer({canvas: document.createElement('canvas')})
  const target = new RenderTarget(256, 256, {type: HalfFloatType})
  const environment = new StudioEnvironment
  const geometry = createKnotGeometry()
  const plane = new PlaneGeometry(2, 2)
  const studio = new MeshBasicNodeMaterial
  studio.colorNode = studioRadiance(vec3(positionGeometry.xy, 0.5))
  const materials = [new AmberVigil(environment), new RimeCathedral(environment), new MoireVespers(environment)]
  const errors: Array<string> = []
  const results = []
  try {
    await renderer.init()
    const {device} = renderer.backend as typeof renderer.backend & {device: GPUDevice}
    device.addEventListener('uncapturederror', event => errors.push(event.error.message))
    renderer.setClearColor(0, 0)
    renderer.setRenderTarget(target)
    const scene = new Scene
    const key = new DirectionalLight(hsl.integer(81, 100, 95.4), 2.3)
    key.position.set(-3, 9, -16)
    scene.add(new AmbientLight(hsl.integer(0, 0, 100), 0.45), new HemisphereLight(hsl.integer(258, 100, 93), hsl.integer(72, 20, 48), 1.3), key)
    const camera = new PerspectiveCamera(40, 1, 0.05, 100)
    const read = async (viewCamera: OrthographicCamera | PerspectiveCamera, name: string, minimum: number) => {
      renderer.render(scene, viewCamera)
      const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 256, 256) as Uint16Array
      let visible = 0
      let dark = 0
      for (let i = 0; i < pixels.length; i += 4) {
        if (!pixels[i + 3]) {
          continue
        }
        visible++
        let sum = 0
        for (let c = 0; c < 3; c++) {
          const value = DataUtils.fromHalfFloat(pixels[i + c])
          assert(Number.isFinite(value), `${name} produced non-finite HDR pixels`)
          sum += value
        }
        if (sum < minimum) {
          dark++
        }
      }
      assert(visible > 1000, `${name} produced an empty or unexpectedly small render`)
      assert(dark === 0, `${name} produced ${dark} black pixels`)
      return {
        name,
        visible,
        dark,
      }
    }
    const panel = new Mesh(plane, studio)
    scene.add(panel)
    const panelCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    panelCamera.position.z = 2
    results.push(await read(panelCamera, 'analytic studio', 0.3))
    scene.remove(panel)
    for (const material of materials) {
      const mesh = new Mesh(geometry, material)
      scene.add(mesh)
      for (const distance of [1.4, 2.1, 3.5]) {
        for (const angle of [0.18, 0.96, 1.75, 3.1]) {
          camera.position.set(Math.sin(angle) * distance, 0.2, Math.cos(angle) * distance)
          camera.lookAt(0, 0, 0)
          mesh.rotation.y = 0.43
          results.push(await read(camera, `${material.name}:${distance}:${angle}`, 0.0001))
        }
      }
      scene.remove(mesh)
    }
    await device.queue.onSubmittedWorkDone()
    assert(errors.length === 0, errors.join('\n'))
    return {
      results,
      errors,
    }
  } finally {
    renderer.setRenderTarget(null)
    for (const material of materials) {
      material.dispose()
    }
    studio.dispose()
    plane.dispose()
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
