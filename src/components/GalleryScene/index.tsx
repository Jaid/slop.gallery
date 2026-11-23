import Architecture from '#component/Architecture'
import GalleryReflection from '#component/GalleryReflection'
import Props from '#component/Props'
import RoomCulling from '#component/RoomCulling'
import ShadowPool from '#component/ShadowPool'
import Sloperator from '#component/Sloperator'

export default function GalleryScene() {
  return <>
    <Architecture />
    <GalleryReflection />
    <RoomCulling />
    <ShadowPool />
    <Props />
    <Sloperator />
  </>
}
