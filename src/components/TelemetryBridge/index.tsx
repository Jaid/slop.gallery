import type {Attributes} from 'victoria-browser-client'

import {useThree} from '@react-three/fiber'
import Branch from 'branch-component'
import {AimInspector} from 'ego-player'
import {useEffect, useState} from 'react'
import useEgoTelemetry from 'telemethree-ego/react'
import usePauseMenuTelemetry from 'telemethree-pause-menu/react'
import useThreeTelemetry from 'telemethree/react'
import {Vector3} from 'three/webgpu'

import {useGallery} from '#src/lib/gallery.ts'
import {useGeofences} from '#src/lib/gallery/geofences.ts'
import pauseMenu from '#src/lib/pauseMenu.ts'
import {getAntiAliasing} from '#src/lib/rendering/antiAliasing.ts'
import {graphicsProfile, graphicsQuality, isHeavyGraphics} from '#src/lib/rendering/graphicsQuality.ts'
import {describeObject, lampSwitches} from '#src/lib/rendering/lightLevels.ts'
import {shadowPool} from '#src/lib/rendering/shadowPool.ts'
import {playerTelemetry, telemetry} from '#src/lib/telemetry/index.ts'
import recordGeofenceCrossings from '#src/lib/telemetry/recordGeofenceCrossings.ts'
import {roomChangeDetails} from '#src/lib/telemetry/SlopGalleryTelemetry.ts'
import {attachWorldTuningTelemetry} from '#src/lib/telemetry/worldTuningTelemetry.ts'
import worldClock from '#src/lib/worldClock.ts'
import {useWorldTuningPanel} from '#src/lib/worldTuning/panel.ts'
import world from '#src/worlds/current.ts'

/** the antialiasing of this page’s graphics */
const antiAliasing = getAntiAliasing(isHeavyGraphics)
function Collectors() {
  usePauseMenuTelemetry({
    menu: pauseMenu,
    telemetry: telemetry!,
  })
  const scene = useThree(state => state.scene)
  const camera = useThree(state => state.camera)
  const inspector = new AimInspector(scene, camera)
  const [aimOrigin] = useState(() => new Vector3)
  const [aimDirection] = useState(() => new Vector3)
  const canvas = useThree(state => state.renderer.domElement)
  useEffect(() => {
    roomChangeDetails.current = (from, to) => {
      const {enabled, enabledCount, disabled, disabledCount} = lampSwitches(scene, from, to)
      return {
        'lights.enabled': enabled,
        'lights.enabled.count': enabledCount,
        'lights.disabled': disabled,
        'lights.disabled.count': disabledCount,
      }
    }
    shadowPool.onOverflow = lights => {
      telemetry!.log(`${lights.length} lights in view ask for a shadow, but the shadow pool only has ${shadowPool.slots.length} slots.`, {
        level: 'warn',
        attributes: {
          'event.name': 'gallery.shadows.overflow',
          room: useGallery.getState().room,
          'shadows.requested': lights.length,
          'shadows.slots': shadowPool.slots.length,
          'shadows.lights': lights.map(describeObject).join(', '),
        },
        context: telemetry!.getContext(),
      })
    }
    return () => {
      roomChangeDetails.current = () => ({})
      shadowPool.onOverflow = undefined
    }
  }, [scene])
  useEffect(() => recordGeofenceCrossings(telemetry!, useGeofences, id => world.roomById(id)?.title), [])
  useEffect(() => attachWorldTuningTelemetry(telemetry!, () => ({
    'graphics.profile': graphicsQuality,
    'canvas.width': canvas.width,
    'canvas.height': canvas.height,
    room: useGallery.getState().room,
  })), [canvas])
  useThreeTelemetry({
    telemetry: telemetry!,
    getAttributes: () => {
      const {room, locked} = useGallery.getState()
      return {
        room,
        locked,
        'graphics.profile': graphicsQuality,
        'graphics.shadows': graphicsProfile.shadows,
        'graphics.postprocessing': graphicsProfile.postprocessing,
        'graphics.anti_aliasing': antiAliasing || 'none',
        'graphics.mirror_reflections': graphicsProfile.mirrorReflections,
        'graphics.noise_textures': graphicsProfile.noiseTextures,
        'graphics.volumetric_light': graphicsProfile.volumetricLight,
        'world_tuning.open': useWorldTuningPanel.getState().open,
      }
    },
    getTraceContext: () => telemetry!.getContext(),
    // The Escape key’s pause menu stops the frames, which is no stall.
    pauses: worldClock,
    getHitchAttributes: (): Attributes => {
      const player = playerTelemetry.read?.()
      return player ? {'ego.speed': Math.hypot(player.velocity.x, player.velocity.y, player.velocity.z)} : {}
    },
  })
  useEgoTelemetry({
    telemetry: telemetry!,
    intervalMs: 0,
    readAimHit: () => inspector.getAim().hit,
    read: () => {
      const player = playerTelemetry.read?.()
      return player ? {
        ...player,
        aim: {
          origin: camera.getWorldPosition(aimOrigin),
          direction: camera.getWorldDirection(aimDirection),
        },
      } : null
    },
  })
  return null
}
function TelemetryBridge() {
  return <Branch if={telemetry} then={Collectors} />
}
export default TelemetryBridge
