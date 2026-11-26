import Branch from 'branch-component'

import Architecture from '#component/Architecture'
import GalleryReflection from '#component/GalleryReflection'
import Props from '#component/Props'
import RoomCulling from '#component/RoomCulling'
import ShadowPool from '#component/ShadowPool'
import Sloperator from '#component/Sloperator'
import {graphicsProfile, shadowsEnabled} from '#src/lib/rendering/graphicsMode.ts'

export default function GalleryScene() {
  return <>
    <Architecture />
    <Branch if={graphicsProfile.mirrorReflections} then={GalleryReflection} />
    <RoomCulling />
    <Branch if={shadowsEnabled} then={ShadowPool} />
    <Props />
    <Sloperator />
  </>
}
