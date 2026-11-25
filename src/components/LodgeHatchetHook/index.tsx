import type {Material} from 'three/webgpu'

import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {lodgeHatchetHook} from '#src/lib/gallery/lodgeInterior/layout.ts'
import createLodgeHatchetHookGeometry, {createLodgeHatchetLeatherGeometry} from '#src/lib/gallery/lodgeInterior/LodgeHatchetHookGeometry.ts'

/** Permanent iron hook on the front of the right fireplace pillar; the hatchet is a separate, pickable prop. */
export default function LodgeHatchetHook({material}: {material: Material}) {
  const geometry = useDisposable(useMemo(() => createLodgeHatchetHookGeometry(), []))
  const leather = useDisposable(useMemo(() => createLodgeHatchetLeatherGeometry(), []))
  const leatherMaterial = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: hsl.integer(57, 43, 22),
    roughness: 0.9,
  }), []))
  return <group name='lodge-hatchet-hook' position={lodgeHatchetHook.position}>
    <mesh castShadow geometry={geometry} material={material} name='lodge-hatchet-hook-iron' receiveShadow />
    <mesh castShadow geometry={leather} material={leatherMaterial} name='lodge-hatchet-leather-band' receiveShadow />
  </group>
}
