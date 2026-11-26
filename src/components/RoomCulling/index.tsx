import type {ScreenRect} from '#src/lib/gallery/roomVisibility.ts'
import type {GalleryRoomId as RoomId} from '#src/worlds/gallery/index.ts'
import type {Camera, DirectionalLight, Light, LightShadow, Object3D} from 'three/webgpu'

import {useThree} from '@react-three/fiber'
import {useLayoutEffect} from 'react'
import ShadowCache, {reachesFrustum, ShadowRefresher} from 'three-shadow-cache'
import {Box3, Frustum, Matrix4, Vector3} from 'three/webgpu'

import {useGallery} from '#src/lib/gallery.ts'
import {ownerRoom, roomContaining, roomsAt, screenRect, updatePickupRoom, visibleRegions, whereaboutsAt} from '#src/lib/gallery/roomVisibility.ts'
import {sunTightSpaces} from '#src/lib/gallery/sun.ts'
import {getReflectionHeight} from '#src/lib/materials/PlanarMirrorMaterial.ts'
import {GalleryRenderer} from '#src/lib/rendering/GalleryRenderer.ts'
import {graphicsProfile, shadowsEnabled} from '#src/lib/rendering/graphicsMode.ts'
import {lightActive} from '#src/lib/rendering/lightLevels.ts'
import {hasGeometry, worldBounds} from '#src/lib/rendering/worldBounds.ts'
import {enabledRooms} from '#src/worlds/gallery/activations.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

/** what the sun reaches none of, so whatever turns or moves wholly inside, like Moonfall’s meteorite, leaves its shadow map alone */
const sunTight = sunTightSpaces(slopGallery.rooms)
const unreached = (light: Light) => ((light as DirectionalLight).isDirectionalLight ? sunTight : undefined)
const viewProjection = new Matrix4
const frustum = new Frustum
const position = new Vector3
const mirrored = new Box3
const lightHolders = new WeakMap<Object3D, boolean>
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
/** the box as seen in a horizontal mirror at the given height */
const mirror = (box: Box3, height: number) => {
  mirrored.copy(box)
  mirrored.min.y = 2 * height - box.max.y
  mirrored.max.y = 2 * height - box.min.y
  return mirrored
}
/** what the camera sees of each room through the openings, limited to the rooms it stands in and those the fences around it keep enabled, see `activations.ts` */
const relatedRegions = (from: ReadonlyArray<RoomId>, related: ReadonlySet<RoomId>) => {
  const regions = visibleRegions(from, viewProjection)
  for (const room of regions.keys()) {
    if (!related.has(room)) {
      regions.delete(room)
    }
  }
  return regions
}
/**
 * Leaves out what the camera can’t see from the rooms it is in. Every mesh has one owner room (see `ownerRoom`), and a room only shows when the camera stands in it or when it is one of the rooms the fences around the camera keep enabled in `activations.ts`, its rooms’ and those of the parts of them it is in, seen through an opening, and then only through the part of the screen the opening covers, up to three openings deep.
 * Rooms out of sight drop out of every pass of the frame: the camera, its reflection and the lamps’ shadow maps. Objects in a room in sight that miss its openings on screen only drop out of the camera and its reflection, so the shadows they cast stay.
 * The sun shines from outside every room, through openings and skylights that rooms out of sight may frame, so its shadow map keeps them all; otherwise the patches of sunlight would change shape whenever a room leaves the view. It only leaves alone what changes wholly inside a room whose shell keeps it out (`Room.sunTight`).
 * Culling and the shadow cache start behind the loading screen, where culling leaves out every room but the camera’s, in the sun’s shadow map too, so that only what the start view sees gets built there. Objects in the camera’s rooms and the rooms related to them stream in first afterward.
 * Shadow maps only update when something in their light’s reach changes, and lights switched off by the fences the player is in, or in hidden rooms without reaching into the view, wait until they matter again. Lights themselves stay, since a different set of lights would recompile every lit material.
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
    const shadows = shadowsEnabled ? new ShadowCache : null
    const refresher = shadowsEnabled ? new ShadowRefresher : null
    const related = new Set<RoomId>
    const cull = (camera: Camera) => {
      hidden.clear()
      hiddenFromView.clear()
      camera.updateWorldMatrix(true, false)
      const eye = camera.getWorldPosition(position).toArray()
      const from = roomsAt(eye)
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      const mirrorY = graphicsProfile.mirrorReflections ? getReflectionHeight() : null
      related.clear()
      for (const room of [...from, ...enabledRooms(whereaboutsAt(eye, from))]) {
        related.add(room)
      }
      const regions = from.length ? relatedRegions(from, related) : undefined
      const inSight = (rects: ReadonlyArray<ScreenRect>, box: Box3) => {
        const rect = screenRect(box, viewProjection)
        return rect !== undefined && rects.some(([left, bottom, right, top]) => rect[0] <= right && rect[2] >= left && rect[1] <= top && rect[3] >= bottom)
      }
      const visit = (object: Object3D, parentRoom: RoomId | undefined) => {
        updatePickupRoom(object)
        const room = ownerRoom(object, parentRoom)
        if (refresher) {
          const light = object as Light & {shadow?: LightShadow}
          if (light.isLight && light.shadow) {
            shadowCameras.add(light.shadow.camera)
            // Behind the loading screen, the sun would otherwise build every hidden room.
            if ((light as DirectionalLight).isDirectionalLight && ready) {
              unculledCameras.add(light.shadow.camera)
            }
            refresher.visit(light as Light & {shadow: LightShadow}, shadowCamera => galleryRenderer.shadowIncomplete(shadowCamera))
          }
        }
        if (regions && room && !from.includes(room) && hasGeometry(object) && !holdsLight(object)) {
          // Behind the loading screen, only the camera’s rooms get built; the rooms seen through their openings stream in first afterward.
          const rects = ready ? regions.get(room) : undefined
          if (!rects) {
            hidden.add(object)
          } else if (object.frustumCulled) {
            // Objects that skip frustum culling, like spray their shader moves, reach past their bounds, so they show wherever their room does.
            const world = worldBounds(object)
            if (!inSight(rects, world) && (mirrorY === null || !inSight(rects, mirror(world, mirrorY)))) {
              hiddenFromView.add(object)
            }
          }
        }
        for (const child of object.children) {
          visit(child, room)
        }
      }
      visit(scene, undefined)
      if (shadows && refresher) {
        refresher.endFrame()
        frustum.setFromProjectionMatrix(viewProjection, camera.coordinateSystem, camera.reversedDepth)
        shadows.update(scene, {
          hidden,
          unreached,
          active(light) {
            if (!lightActive.current(light)) {
              return false
            }
            const lightRoom = regions && roomContaining(position.setFromMatrixPosition(light.matrixWorld).toArray())
            // A lamp in a room out of sight that shines into view, like the Exhibition’s north tunnel lamp up through the Lobby’s floor, needs its shadows as much as one in sight: a stale map lets its light through whatever stood in its way.
            return !lightRoom || regions.has(lightRoom) || reachesFrustum(light, frustum)
          },
        })
      }
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
      shadows?.dispose()
    }
  }, [galleryRenderer, ready, scene])
  return null
}
