import type {ScreenRect} from '#src/lib/gallery/roomVisibility.ts'
import type {GalleryRoomId as RoomId} from '#src/worlds/gallery/index.ts'
import type {BufferGeometry, Camera, DirectionalLight, Light, LightShadow, Object3D} from 'three/webgpu'

import {useThree} from '@react-three/fiber'
import {useLayoutEffect} from 'react'
import ShadowCache, {reachesFrustum, ShadowRefresher} from 'three-shadow-cache'
import {Box3, Frustum, Matrix4, Vector3} from 'three/webgpu'

import {useGallery} from '#src/lib/gallery.ts'
import {ownerRoom, roomBoxes, roomContaining, roomsAt, screenRect, updatePickupRoom, visibleRegions} from '#src/lib/gallery/roomVisibility.ts'
import {getFloorReflectionHeight} from '#src/lib/materials/FloorMaterial.ts'
import {GalleryRenderer} from '#src/lib/rendering/GalleryRenderer.ts'
import {lightActive} from '#src/lib/rendering/lightLevels.ts'
import relations from '#src/worlds/gallery/relations.ts'

type Drawable = Object3D & {
  boundingBox?: Box3 | null
  computeBoundingBox?: () => void
  geometry?: BufferGeometry
}
type Placement = {
  bounds: Box3
  matrix: Matrix4
  world: Box3
}

const viewProjection = new Matrix4
const frustum = new Frustum
const position = new Vector3
const mirrored = new Box3
const lightHolders = new WeakMap<Object3D, boolean>
const placements = new WeakMap<Object3D, Placement>
/** the drawable’s world bounds, kept until it moves or its bounds change */
const boundsOf = (drawable: Drawable, geometry: BufferGeometry) => {
  // Instanced and batched meshes bound all of their instances themselves.
  if (drawable.computeBoundingBox && drawable.boundingBox === null) {
    drawable.computeBoundingBox()
  }
  if (!drawable.boundingBox && !geometry.boundingBox) {
    geometry.computeBoundingBox()
  }
  const bounds = drawable.boundingBox ?? geometry.boundingBox!
  const cached = placements.get(drawable)
  if (cached?.matrix.equals(drawable.matrixWorld) && cached.bounds.equals(bounds)) {
    return cached.world
  }
  const placement = {
    bounds: bounds.clone(),
    matrix: drawable.matrixWorld.clone(),
    world: bounds.clone().applyMatrix4(drawable.matrixWorld),
  }
  placements.set(drawable, placement)
  return placement.world
}
const ownerOf = (object: Object3D): RoomId | undefined => ownerRoom(object, object.parent ? ownerOf(object.parent) : undefined)
const holdsLight = (object: Object3D) => {
  let result = lightHolders.get(object)
  if (result === undefined) {
    result = false
    object.traverse(child => {
      result ||= (child as Light).isLight
    })
    lightHolders.set(object, result)
  }
  return result
}
/** the box mirrored by a floor at the height, as the floor reflection shows it */
const mirror = (box: Box3, floorY: number) => {
  mirrored.copy(box)
  mirrored.min.y = 2 * floorY - box.max.y
  mirrored.max.y = 2 * floorY - box.min.y
  return mirrored
}
/** what the camera sees of each room through the openings, limited to the rooms the camera’s rooms list in `relations.ts` */
const relatedRegions = (from: ReadonlyArray<RoomId>) => {
  const regions = visibleRegions(from, viewProjection)
  const allowed = new Set<RoomId>(from.flatMap(room => [room, ...relations[room].rooms]))
  for (const room of regions.keys()) {
    if (!allowed.has(room)) {
      regions.delete(room)
    }
  }
  return regions
}
/**
 * Leaves out what the camera can’t see from the rooms it is in. Every mesh has one owner room (see `ownerRoom`), and a room only shows when the camera stands in it or when it is one of the rooms those list in `relations.ts` seen through an opening, and then only through the part of the screen the opening covers, up to three openings deep.
 * Rooms out of sight drop out of every pass of the frame: the camera, its reflection and the lamps’ shadow maps. Objects in a room in sight that miss its openings on screen only drop out of the camera and its reflection, so the shadows they cast stay.
 * The sun shines from outside every room, through openings and skylights that rooms out of sight may frame, so its shadow map keeps them all; otherwise the patches of sunlight would change shape whenever a room leaves the view.
 * Culling and the shadow cache start behind the loading screen, where culling leaves out every room but the camera’s, in the sun’s shadow map too, so that only what the start view sees gets built there. Objects in the camera’s rooms and the rooms related to them stream in first afterward.
 * Shadow maps only update when something in their light’s reach changes, and lights switched off by their room list, or in hidden rooms without reaching into the view, wait until they matter again. Lights themselves stay, since a different set of lights would recompile every lit material.
 */
export default function RoomCulling() {
  const renderer = useThree(state => state.renderer)
  const scene = useThree(state => state.scene)
  const ready = useGallery(s => s.ready)
  const galleryRenderer = renderer instanceof GalleryRenderer ? renderer : null
  // A layout effect, so that culling is in place before the first frame builds what the start view can’t see.
  useLayoutEffect(() => {
    if (!galleryRenderer) {
      return
    }
    const {hidden, hiddenFromView, shadowCameras, unculledCameras} = galleryRenderer
    const shadows = new ShadowCache
    const refresher = new ShadowRefresher
    const related = new Set<RoomId>
    const cull = (camera: Camera) => {
      hidden.clear()
      hiddenFromView.clear()
      camera.updateWorldMatrix(true, false)
      const from = roomsAt(camera.getWorldPosition(position).toArray())
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      // The floor reflection shows the rooms behind openings mirrored by the floors it mirrors, by default those of the room the camera is in.
      const floorY = getFloorReflectionHeight() ?? roomBoxes.find(({id}) => id === from[0])?.floorY ?? 0
      const regions = from.length ? relatedRegions(from) : undefined
      related.clear()
      for (const room of from) {
        related.add(room)
        for (const other of relations[room].rooms) {
          related.add(other)
        }
      }
      const inSight = (rects: ReadonlyArray<ScreenRect>, box: Box3) => {
        const rect = screenRect(box, viewProjection)
        return rect !== undefined && rects.some(([left, bottom, right, top]) => rect[0] <= right && rect[2] >= left && rect[1] <= top && rect[3] >= bottom)
      }
      const visit = (object: Object3D, parentRoom: RoomId | undefined) => {
        updatePickupRoom(object)
        const room = ownerRoom(object, parentRoom)
        const drawable = object as Drawable
        const light = object as Light & {shadow?: LightShadow}
        if (light.isLight && light.shadow) {
          shadowCameras.add(light.shadow.camera)
          // Behind the loading screen, the sun would otherwise build every hidden room.
          if ((light as DirectionalLight).isDirectionalLight && ready) {
            unculledCameras.add(light.shadow.camera)
          }
          refresher.visit(light as Light & {shadow: LightShadow}, shadowCamera => galleryRenderer.shadowIncomplete(shadowCamera))
        }
        if (regions && room && !from.includes(room) && drawable.geometry && drawable.frustumCulled && !holdsLight(object)) {
          // Behind the loading screen, only the camera’s rooms get built; the rooms seen through their openings stream in first afterward.
          const rects = ready ? regions.get(room) : undefined
          if (!rects) {
            hidden.add(object)
          } else {
            const world = boundsOf(drawable, drawable.geometry)
            if (!inSight(rects, world) && !inSight(rects, mirror(world, floorY))) {
              hiddenFromView.add(object)
            }
          }
        }
        for (const child of object.children) {
          visit(child, room)
        }
      }
      visit(scene, undefined)
      refresher.endFrame()
      frustum.setFromProjectionMatrix(viewProjection, camera.coordinateSystem, camera.reversedDepth)
      shadows.update(scene, {
        hidden,
        active(light) {
          if (!lightActive.current(light)) {
            return false
          }
          const lightRoom = regions && roomContaining(position.setFromMatrixPosition(light.matrixWorld).toArray())
          // A lamp in a room out of sight that shines into view, like the Exhibition’s green one up through the Lobby’s floor, needs its shadows as much as one in sight: a stale map lets its light through whatever stood in its way.
          return !lightRoom || regions.has(lightRoom) || reachesFrustum(light, frustum)
        },
      })
    }
    galleryRenderer.setCuller(cull)
    // Objects of no room never get culled, so they count as nearby.
    galleryRenderer.setStreamPriority(object => {
      const room = ownerOf(object)
      return !related.size || !room || related.has(room)
    })
    return () => {
      galleryRenderer.setCuller(null)
      galleryRenderer.setStreamPriority(null)
      shadows.dispose()
    }
  }, [galleryRenderer, ready, scene])
  return null
}
