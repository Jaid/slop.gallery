import type {KnotMaterialConstructor} from '../src/main.ts'

import {expect, spyOn, test} from 'bun:test'

import {MeshPhysicalNodeMaterial, Texture} from 'three/webgpu'

import KnotMaterials from '../src/KnotMaterials.ts'
import KnotMaterial from '../src/lib/KnotMaterial.ts'

const entries = [{id: 'first'}, {id: 'later'}]
/** a loader whose modules arrive when the test resolves them */
function deferredLoader() {
  const requested: Array<string> = []
  const modules = new Map<string, ReturnType<typeof Promise.withResolvers<KnotMaterialConstructor>>>
  const deliver = (id: string, Material: KnotMaterialConstructor = TestMaterial) => {
    const module = modules.get(id)!
    module.resolve(Material)
    return module.promise
  }
  const load = ({id}: {id: string}) => {
    requested.push(id)
    const loading = Promise.withResolvers<KnotMaterialConstructor>()
    modules.set(id, loading)
    return loading.promise
  }
  return {
    load,
    deliver,
    requested,
  }
}
class TestMaterial extends KnotMaterial {}
test('shaders only load once subscribed, and each arrival publishes a new snapshot with the full material', async () => {
  const loader = deferredLoader()
  const environment = new Texture
  const materials = new KnotMaterials(entries, loader.load, environment)
  try {
    const initial = materials.getSnapshot()
    expect(initial).toEqual([undefined, undefined])
    expect(loader.requested).toEqual([])
    expect(materials.pendingMaterials).toEqual([])
    let notifications = 0
    const unsubscribe = materials.subscribe(() => notifications++)
    // StrictMode subscribes twice, which must not load anything twice.
    unsubscribe()
    materials.subscribe(() => notifications++)
    expect(loader.requested).toEqual(['first', 'later'])
    expect(materials.pendingMaterials).toEqual(['first', 'later'])
    await loader.deliver('later')
    expect(notifications).toBe(1)
    const snapshot = materials.getSnapshot()
    expect(snapshot).not.toBe(initial)
    expect(snapshot[0]).toBeUndefined()
    expect(snapshot[1]).toBeInstanceOf(TestMaterial)
    expect(snapshot[1]!.name).toBe('later')
    expect(snapshot[1]!.envMap).toBe(environment)
    expect(materials.getSnapshot()).toBe(snapshot)
    expect(materials.pendingMaterials).toEqual(['first'])
  } finally {
    materials.dispose()
    environment.dispose()
  }
})
test('a shader that arrives after disposal is never built, and disposal releases what the materials own but not the caller’s environment', async () => {
  const loader = deferredLoader()
  const environment = new Texture
  let environmentDisposals = 0
  environment.addEventListener('dispose', () => environmentDisposals++)
  const materials = new KnotMaterials(entries, loader.load, environment)
  const unsubscribe = materials.subscribe(() => {})
  await loader.deliver('first')
  const material = materials.getSnapshot()[0]!
  let materialDisposals = 0
  material.addEventListener('dispose', () => materialDisposals++)
  let geometryDisposals = 0
  materials.resources.items[0].geometry.addEventListener('dispose', () => geometryDisposals++)
  unsubscribe()
  materials.dispose()
  expect(materialDisposals).toBe(1)
  expect(geometryDisposals).toBe(1)
  expect(environmentDisposals).toBe(0)
  let lateBuilds = 0
  await loader.deliver('later', class extends TestMaterial {
    constructor(texture: Texture) {
      super(texture)
      lateBuilds++
    }
  })
  expect(lateBuilds).toBe(0)
  environment.dispose()
})
test('a knot with a core brings it along, and one whose shader fails stops counting as pending', async () => {
  class LayeredMaterial extends KnotMaterial {
    constructor(environment: Texture) {
      super(environment)
      this.coreMaterial = new MeshPhysicalNodeMaterial({envMap: environment})
    }
  }
  const materials = new KnotMaterials(entries, ({id}) => {
    if (id === 'later') {
      throw new Error('missing shader')
    }
    return LayeredMaterial
  })
  const failure = Promise.withResolvers<unknown>()
  const quiet = spyOn(console, 'error').mockImplementation((_message, _id, error) => failure.resolve(error))
  try {
    materials.subscribe(() => {})
    expect(await failure.promise).toEqual(new Error('missing shader'))
    const [material] = materials.getSnapshot()
    expect(material?.coreMaterial).toBeInstanceOf(MeshPhysicalNodeMaterial)
    expect(materials.pendingMaterials).toEqual([])
  } finally {
    quiet.mockRestore()
    materials.dispose()
  }
})
