import type {KnotMaterialConstructor} from '../src/main.ts'

import {expect, spyOn, test} from 'bun:test'

import {MeshPhysicalNodeMaterial, Texture} from 'three/webgpu'

import DirectKnotMaterials from '../src/knotMaterials/DirectKnotMaterials.ts'
import KnotMaterial from '../src/lib/KnotMaterial.ts'
import {knotsById} from '../src/main.ts'

const entry = knotsById.get('lenticular_mirage')!
const entries = [entry, {
  ...entry,
  id: 'later',
}]
async function flush() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}
/** a loader whose modules arrive when the test resolves them */
function deferredLoader() {
  const requested: Array<string> = []
  const modules = new Map<string, ReturnType<typeof Promise.withResolvers<KnotMaterialConstructor>>>
  const load = ({id}: {id: string}) => {
    requested.push(id)
    const loading = Promise.withResolvers<KnotMaterialConstructor>()
    modules.set(id, loading)
    return loading.promise
  }
  return {
    load,
    modules,
    requested,
  }
}
class TestMaterial extends KnotMaterial {}
test('shaders only load once subscribed, and each arrival publishes a new snapshot with the full material', async () => {
  const loader = deferredLoader()
  const environment = new Texture
  const materials = new DirectKnotMaterials(entries, loader.load, environment)
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
    expect(loader.requested).toEqual([entry.id, 'later'])
    expect(materials.pendingMaterials).toEqual([entry.id, 'later'])
    loader.modules.get('later')!.resolve(TestMaterial)
    await flush()
    expect(notifications).toBe(1)
    const snapshot = materials.getSnapshot()
    expect(snapshot).not.toBe(initial)
    expect(snapshot[0]).toBeUndefined()
    expect(snapshot[1]).toBeInstanceOf(TestMaterial)
    expect(snapshot[1]!.name).toBe('later')
    expect(snapshot[1]!.envMap).toBe(environment)
    expect(materials.getSnapshot()).toBe(snapshot)
    expect(materials.pendingMaterials).toEqual([entry.id])
  } finally {
    await materials.disposeAsync()
    environment.dispose()
  }
})
test('a shader that arrives after disposal is never built, and disposal releases what the materials own but not the caller’s environment', async () => {
  const loader = deferredLoader()
  const environment = new Texture
  let environmentDisposals = 0
  environment.addEventListener('dispose', () => environmentDisposals++)
  const materials = new DirectKnotMaterials(entries, loader.load, environment)
  const unsubscribe = materials.subscribe(() => {})
  loader.modules.get(entry.id)!.resolve(TestMaterial)
  await flush()
  const material = materials.getSnapshot()[0]!
  let materialDisposals = 0
  material.addEventListener('dispose', () => materialDisposals++)
  let geometryDisposals = 0
  materials.resources.items[0].geometry.addEventListener('dispose', () => geometryDisposals++)
  unsubscribe()
  await materials.disposeAsync()
  expect(materialDisposals).toBe(1)
  expect(geometryDisposals).toBe(1)
  expect(environmentDisposals).toBe(0)
  loader.modules.get('later')!.resolve(TestMaterial)
  await flush()
  expect(materials.fullMaterials[1]).toBeUndefined()
  expect(materials.getSnapshot()[1]).toBeUndefined()
  environment.dispose()
})
test('a knot with a core brings it along, and one whose shader fails stops counting as pending', async () => {
  class LayeredMaterial extends KnotMaterial {
    constructor(environment: Texture) {
      super(environment)
      this.coreMaterial = new MeshPhysicalNodeMaterial({envMap: environment})
    }
  }
  const materials = new DirectKnotMaterials(entries, ({id}) => {
    if (id === 'later') {
      throw new Error('missing shader')
    }
    return LayeredMaterial
  })
  const quiet = spyOn(console, 'error').mockImplementation(() => {})
  try {
    materials.subscribe(() => {})
  } finally {
    quiet.mockRestore()
  }
  try {
    const [material] = materials.getSnapshot()
    expect(material?.coreMaterial).toBeInstanceOf(MeshPhysicalNodeMaterial)
    expect(materials.pendingMaterials).toEqual([])
  } finally {
    await materials.disposeAsync()
  }
})
