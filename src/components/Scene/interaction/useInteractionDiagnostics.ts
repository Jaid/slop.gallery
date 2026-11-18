import type {Placement, Vec3} from '#src/lib/gallery.ts'
import type {MutableRef} from './types.ts'
import type {RootState} from '@react-three/fiber'

import {useEffect} from 'react'
import {Euler, PerspectiveCamera, Quaternion, Vector3} from 'three/webgpu'

import {flyPlayer, galleryEvents, useGallery} from '#src/lib/gallery.ts'
import {flyMode} from '#src/lib/gallery/flyMode.ts'
import portraitObjects from '#src/lib/gallery/portraitObjects.ts'
import {usePortraitSpectation} from '#src/lib/gallery/portraitSpectation.ts'
import {mountedRoomIds} from '#src/lib/gallery/roomLoading.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import {loadingItems} from '#src/lib/loadingItems.ts'
import pauseMenu from '#src/lib/pauseMenu.ts'
import PlayerGrace from '#src/lib/physics/PlayerGrace.ts'
import worldClock from '#src/lib/worldClock.ts'
import world from '#src/worlds/current.ts'

import {propObjects} from '../GrabbableProp.tsx'

export default function useInteractionDiagnostics(camera: RootState['camera'], renderer: RootState['renderer'], placement: MutableRef<Placement | null>) {
  useEffect(() => {
    globalThis.slopGallery ??= {}
    const api = globalThis.slopGallery
    api.snapshot = () => ({
      webGPU: 'isWebGPUBackend' in renderer.backend && renderer.backend.isWebGPUBackend === true,
      camera: camera.position.toArray(),
      rotation: camera.rotation.toArray(),
      ready: useGallery.getState().ready,
      loadingItems: loadingItems(),
      registered: portraitObjects.size,
      room: useGallery.getState().room,
      placement: placement.current,
      locked: useGallery.getState().locked,
      menuStage: pauseMenu.getSnapshot().stage,
      frozen: worldClock.frozen,
      held: useGallery.getState().held,
      active: useGallery.getState().active,
      activeLabel: useGallery.getState().activeLabel,
      seed: environmentSeed,
      spectating: usePortraitSpectation.getState().id,
      worldReach: {
        mode: world.reach.mode,
        origin: world.reach.origin,
        rooms: world.reach.rooms,
      },
      mountedRooms: mountedRoomIds(),
      props: [...propObjects].map(([id, {body, group, mass}]) => ({
        id,
        mass: mass(),
        passing: PlayerGrace.of(body).active,
        position: body.translation(),
        velocity: body.linvel(),
        bodyType: body.bodyType(),
        sleeping: body.isSleeping(),
        visualPosition: group.getWorldPosition(new Vector3).toArray(),
        collidersEnabled: Array.from({length: body.numColliders()}, (_, index) => body.collider(index).isEnabled()),
      })),
      portraits: useGallery.getState().portraits.map(portrait => ({
        id: portrait.id,
        title: portrait.title,
        hung: portrait.hung,
        position: portrait.position,
        wallId: portrait.wallId,
        width: portrait.width,
        height: portrait.height,
        pending: portrait.pending,
        fusing: portrait.fusing,
        reserved: portrait.reserved,
        physical: portraitObjects.get(portrait.id)?.body.translation(),
      })),
    })
    const pageQuery = new URLSearchParams(location.search)
    if (pageQuery.get('test') === 'true') {
      api.teleport = (position: Vec3, rotation: Array<number>) => {
        flyMode.active = false
        galleryEvents.dispatchEvent(new CustomEvent('teleport', {
          detail: {
            position,
            rotation,
          },
        }))
      }
      api.fuse = (first: string, second: string) => galleryEvents.dispatchEvent(new CustomEvent('fusion', {detail: [first, second]}))
      // The player flies wherever a view is to be framed exactly, so there is no camera apart from the player.
      api.fly = ({position, rotation, fov} = {}) => {
        const turned = new Quaternion
        flyPlayer({
          position,
          rotation: rotation && turned.setFromEuler(new Euler(...rotation, 'YXZ')).toArray(),
        })
        // The flight let go of the zoom, so this is the view’s own field of view, which the moods still widen while it is drawn.
        if (fov !== undefined && camera instanceof PerspectiveCamera) {
          camera.fov = fov
          camera.updateProjectionMatrix()
        }
        const euler = new Euler
        euler.setFromQuaternion(camera.quaternion, 'YXZ')
        return {
          position: camera.position.toArray(),
          rotation: [euler.x, euler.y, euler.z],
          fov: camera instanceof PerspectiveCamera ? camera.fov : null,
        }
      }
    }
    return () => {
      delete api.snapshot
      delete api.teleport
      delete api.fuse
      delete api.fly
    }
  }, [camera, placement, renderer])
}
