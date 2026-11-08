import type {Attributes} from 'victoria-browser-client'

import {useThree} from '@react-three/fiber'
import Branch from 'branch-component'
import {AimInspector} from 'ego-player'
import {useEffect, useState} from 'react'
import useEgoTelemetry from 'telemethree-ego/react'
import usePauseMenuTelemetry from 'telemethree-pause-menu/react'
import useThreeTelemetry from 'telemethree/react'
import {Vector3} from 'three/webgpu'
import useGraphicsMode, {useCinematicGraphics} from 'use-graphics-mode'

import {useGallery} from '#src/lib/gallery.ts'
import pauseMenu from '#src/lib/pauseMenu.ts'
import {getAntiAliasing} from '#src/lib/rendering/antiAliasing.ts'
import {useGraphicsTuning} from '#src/lib/rendering/customGraphics.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import {describeObject, roomSwitches} from '#src/lib/rendering/lightLevels.ts'
import {shadowPool} from '#src/lib/rendering/shadowPool.ts'
import {attachGraphicsTuningTelemetry} from '#src/lib/telemetry/graphicsTuningTelemetry.ts'
import {playerTelemetry, telemetry} from '#src/lib/telemetry/index.ts'
import {roomChangeDetails} from '#src/lib/telemetry/SlopGalleryTelemetry.ts'

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
  const isHeavy = useGraphicsMode()
  const isCinematic = useCinematicGraphics()
  const profile = getGraphicsProfile(isHeavy, isCinematic)
  const antiAliasing = getAntiAliasing(isHeavy)
  const canvas = useThree(state => state.renderer.domElement)
  const graphicsProfile = useGraphicsMode.getName(isHeavy, isCinematic)
  useEffect(() => {
    roomChangeDetails.current = (from, to) => {
      const {enabled, enabledCount, disabled, disabledCount} = roomSwitches(scene, from, to)
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
  useEffect(() => attachGraphicsTuningTelemetry(telemetry!, () => ({
    'graphics.profile': graphicsProfile,
    'canvas.width': canvas.width,
    'canvas.height': canvas.height,
    room: useGallery.getState().room,
  })), [canvas, graphicsProfile])
  useThreeTelemetry({
    telemetry: telemetry!,
    getAttributes: () => {
      const {room, locked} = useGallery.getState()
      return {
        room,
        locked,
        'graphics.profile': useGraphicsMode.getName(isHeavy, isCinematic),
        'graphics.shadows': profile.shadows,
        'graphics.postprocessing': profile.postprocessing,
        'graphics.anti_aliasing': antiAliasing || 'none',
        'graphics.floor_reflections': profile.floorReflections,
        'graphics.noise_textures': profile.noiseTextures,
        'graphics.volumetric_light': profile.volumetricLight,
        'graphics.tuning': useGraphicsTuning.getState().open,
      }
    },
    getTraceContext: () => telemetry!.getContext(),
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
