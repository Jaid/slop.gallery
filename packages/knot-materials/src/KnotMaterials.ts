import type {KnotResourceEntry} from './KnotResources.ts'
import type KnotMaterial from './lib/KnotMaterial.ts'
import type {KnotMaterialLoader} from './types.ts'
import type {Texture} from 'three/webgpu'

import KnotResources from './KnotResources.ts'
import StudioEnvironment from './StudioEnvironment.ts'

/** The first subscriber starts loading the exhibition’s shaders. Each arrival publishes a snapshot in exhibit order, ready for useSyncExternalStore. */
export default class KnotMaterials {
  getSnapshot = () => this.snapshot
  readonly resources: KnotResources
  subscribe = (listener: () => void) => {
    if (!this.disposed) {
      this.listeners.add(listener)
    }
    if (!this.started) {
      this.started = true
      for (const [index, entry] of this.entries.entries()) {
        if (this.disposed) {
          break
        }
        this.loadMaterial(entry, index).catch((error: unknown) => console.error('Knot material could not be loaded:', entry.id, error))
      }
    }
    return () => {
      this.listeners.delete(listener)
    }
  }
  private disposed = false
  private readonly environment: Texture
  private readonly listeners = new Set<() => void>
  private readonly ownEnvironment?: StudioEnvironment
  private readonly pending = new Set<number>
  private snapshot: ReadonlyArray<KnotMaterial | undefined>
  private started = false

  constructor(private readonly entries: ReadonlyArray<KnotResourceEntry>, private readonly load: KnotMaterialLoader, environment?: Texture) {
    this.resources = new KnotResources(entries)
    this.environment = environment ?? (this.ownEnvironment = new StudioEnvironment)
    this.snapshot = Array.from({length: entries.length})
  }

  get pendingMaterials() {
    return Array.from(this.pending, index => this.entries[index].id)
  }

  dispose() {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.listeners.clear()
    this.pending.clear()
    this.resources.dispose()
    for (const material of this.snapshot) {
      material?.dispose()
    }
    this.ownEnvironment?.dispose()
  }

  private async loadMaterial(entry: KnotResourceEntry, index: number) {
    this.pending.add(index)
    try {
      const loaded = this.load(entry)
      const Material = loaded instanceof Promise ? await loaded : loaded
      if (this.disposed) {
        return
      }
      const material = new Material(this.environment)
      material.name = entry.id
      this.snapshot = this.snapshot.with(index, material)
    } finally {
      this.pending.delete(index)
    }
    for (const listener of this.listeners) {
      listener()
    }
  }
}
