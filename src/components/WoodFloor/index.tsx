import type {Texture} from 'three/webgpu'

import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {useGraphicsModeValue} from 'use-graphics-mode'

import WoodFloorMaterial from '#src/lib/materials/WoodFloorMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

export default function WoodFloor({width, depth, texture, reflections}: {
  depth: number
  reflections?: boolean
  texture: Texture
  width: number
}) {
  const {mirrorReflections} = useGraphicsModeValue(getGraphicsProfile)
  const reflective = reflections ?? mirrorReflections
  const material = useDisposable(useMemo(() => new WoodFloorMaterial(texture, reflective), [reflective, texture]))
  const reflection = material.reflectionTarget
  return <mesh name='mona-ribbit-room-wood-floor' position={[0, 0.001, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[width, depth]} />
    <primitive attach='material' object={material} />
    <Branch if={reflection}><primitive object={reflection!} /></Branch>
  </mesh>
}
