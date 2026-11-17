import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import GalleryLighting from '#component/GalleryLighting'
import RoomCulling from '#component/RoomCulling'
import ShadowPool from '#component/ShadowPool'
import World from '#component/World'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'

export default function GalleryScene() {
  const heavy = useGraphicsMode()
  const {surfaceAnisotropy} = useGraphicsModeValue(getGraphicsProfile)
  const materials = useDisposable(useMemo(() => new GalleryMaterials(heavy, surfaceAnisotropy), [heavy, surfaceAnisotropy]))
  return <>
    <GalleryLighting />
    <World materials={materials} />
    <RoomCulling />
    <ShadowPool />
  </>
}
