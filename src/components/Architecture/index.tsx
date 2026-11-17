import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import GalleryLighting from '#component/GalleryLighting'
import World from '#component/World'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'

/** Lighting stays global, but rooms load their walls and create only the surfaces they actually use. */
export default function Architecture() {
  const isHeavy = useGraphicsMode()
  const {surfaceAnisotropy} = useGraphicsModeValue(getGraphicsProfile)
  const materials = useDisposable(useMemo(() => new GalleryMaterials(isHeavy, surfaceAnisotropy), [isHeavy, surfaceAnisotropy]))
  return <>
    <GalleryLighting />
    <World materials={materials} />
  </>
}
