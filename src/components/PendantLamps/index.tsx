import type {PendantBody, PendantMount} from '#src/lib/gallery/pendants/index.ts'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {PendantGeometry} from '#src/lib/gallery/pendants/index.ts'
import LanternMetalMaterial from '#src/lib/materials/LanternMetalMaterial.ts'

type Glow = {
  color: number
  emissive: number
  emissiveIntensity: number
}

/** Ceiling-hung light fixtures; each one’s rod reaches the ceiling surface found for its mount. Their lamps belong to the world. */
export default function PendantLamps({body, glow, mounts, name}: {
  body: PendantBody
  glow: Glow
  mounts: ReadonlyArray<PendantMount>
  name: string
}) {
  const set = useDisposable(useMemo(() => new PendantSet(body, mounts, glow), [body, mounts, glow]))
  return <group name={name}>
    {set.items.map(({mount, geometry}, i) => <group key={i} position={mount.light}>
      <mesh geometry={geometry.frame} material={set.frameMaterial} name={`${name}-${body.id}-frame`} />
      <mesh geometry={geometry.glow} material={set.glowMaterial} name={`${name}-${body.id}-glow`} />
    </group>)}
  </group>
}

class PendantSet {
  readonly frameMaterial = new LanternMetalMaterial
  readonly glowMaterial: MeshStandardNodeMaterial
  readonly items: Array<{
    geometry: PendantGeometry
    mount: PendantMount
  }> = []

  constructor(body: PendantBody, mounts: ReadonlyArray<PendantMount>, glow: Glow) {
    this.glowMaterial = new MeshStandardNodeMaterial(glow)
    try {
      for (const mount of mounts) {
        this.items.push({
          mount,
          geometry: new PendantGeometry(body, mount),
        })
      }
    } catch (error) {
      this.dispose()
      throw error
    }
  }

  dispose() {
    for (const {geometry} of this.items) {
      geometry.dispose()
    }
    this.frameMaterial.dispose()
    this.glowMaterial.dispose()
  }
}
