import Architecture from '#component/Architecture'
import GalleryFloorMirror from '#component/GalleryFloorMirror'
import Props from '#component/Props'
import RoomCulling from '#component/RoomCulling'
import ShadowPool from '#component/ShadowPool'
import Sloperator from '#component/Sloperator'

export default function GalleryScene() {
  return <>
    <Architecture />
    <GalleryFloorMirror />
    <RoomCulling />
    <ShadowPool />
    <Props />
    <Sloperator />
  </>
}
