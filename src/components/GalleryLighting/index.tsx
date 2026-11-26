import type {GalleryLightingPreset} from '#src/lib/gallery/lighting.ts'
import type {CanvasTexture, DirectionalLight, Light, Renderer, Scene} from 'three/webgpu'

import {useThree} from '@react-three/fiber'
import {useEffect, useLayoutEffect, useMemo, useRef} from 'react'
import {useShallow} from 'zustand/react/shallow'

import {isDevelopmentMode} from '#src/lib/developmentMode.ts'
import {isTextInput, notify, useGallery} from '#src/lib/gallery.ts'
import {createEnvironment, drawEnvironment} from '#src/lib/gallery/environment.ts'
import {cycleLighting, lightingPresets, tuneLighting, useLighting} from '#src/lib/gallery/lighting.ts'
import lobbyVault from '#src/lib/gallery/lobbyVault.ts'
import {sunGeometry, sunlitPoints, sunShadowMapSize} from '#src/lib/gallery/sun.ts'
import {shineDaylightFrom} from '#src/lib/rendering/daylight.ts'
import {getSunShadowSettings, graphicsProfile, isHeavy} from '#src/lib/rendering/graphicsMode.ts'
import {lampOf} from '#src/lib/rendering/lamps.ts'
import {isShadowSlot, lightActive, lightGain, lightShadow, useLightEdits} from '#src/lib/rendering/lightLevels.ts'
import {getShadowProps} from '#src/lib/rendering/shadowFilterNodes.ts'
import {shadowPool} from '#src/lib/rendering/shadowPool.ts'
import StainedGlassShadowNode from '#src/lib/rendering/StainedGlassShadowNode.ts'
import {lightingTuning} from '#src/lib/worldTuning/LightingTuningModule.ts'
import {pipelineTuning} from '#src/lib/worldTuning/PipelineTuningModule.ts'
import slopGallery from '#src/worlds/gallery/index.ts'
import {skyLook} from '#src/worlds/gallery/sky.ts'

/** key that cycles the lighting presets with `?development`, backwards with Shift */
export const lightingCycleKey = 'KeyL'

const lobby = slopGallery.room('lobby')
/** Where light markers show the sun, which has no position of its own: 2 m above the crown of the Lobby’s vault. */
const sunMarker = [lobby.center[0], lobbyVault.crownY + 2, lobby.center[1]] as const
const antechamber = slopGallery.room('antechamber')
/** every point the sun’s shadow map has to cover */
const sunlit = sunlitPoints(slopGallery.rooms)

type Lamp = Light & {
  isPointLight?: boolean
  isSpotLight?: boolean
}

/**
 * The gallery’s lighting: sun, the sky’s colors, ambient fill, reflection environment and the strength of the rooms’ lamps, all following the current {@link useLighting} preset. Which rooms show the sky is up to their skyboxes.
 * Switching presets only changes colors, intensities, uniforms and the environment’s pixels, never which lights exist, so no material recompiles.
 */
export default function GalleryLighting() {
  const preset = useTunedLighting(lightingPresets[useLighting(s => s.preset)])
  const scene = useThree(s => s.scene)
  const renderer = useThree(s => s.renderer)
  const sunLight = useRef<DirectionalLight>(null)
  const {samples: sunShadowSamples, ...sunShadow} = useSunShadow(sunShadowMapSize)
  const environment = useRef<CanvasTexture>(null)
  // Only the Antechamber, under its stained-glass dome, takes the glass’ colors; the light is set up before its first frame, so its pipelines compile once. Materials that bounce the daylight follow each new sun.
  useLayoutEffect(() => {
    const light = sunLight.current!
    light.shadow.shadowNode = new StainedGlassShadowNode(light, position => position.y.greaterThan(antechamber.floorY - 0.05)
      .and(position.x.sub(antechamber.center[0]).abs().lessThan(antechamber.size[0] / 2))
      .and(position.z.sub(antechamber.center[1]).abs().lessThan(antechamber.size[1] / 2)))
    return shineDaylightFrom(light)
  }, [sunShadowSamples])
  // The environment is part of every lit material’s cache key. Set after the first frame, it would build all of them a second time; a preset only redraws its pixels.
  useLayoutEffect(() => {
    const texture = createEnvironment()
    environment.current = texture
    const restore = setEnvironment(scene, texture)
    return () => {
      restore()
      environment.current = null
      texture.dispose()
    }
  }, [scene])
  // Split by what each part reads, so a tuning slider only redoes its own part; redrawing the environment rebuilds its prefiltered maps.
  const {environment: {gradient, intensity: environmentIntensity, lightBoxes}, exposure, sky, sun: {direction: sunDirection}} = preset
  // The sun stands where its direction says, with a shadow frustum spanning every room it may reach.
  const sun = useMemo(() => sunGeometry(sunDirection, sunlit), [sunDirection])
  const {shadow} = sun
  useLayoutEffect(() => {
    skyLook.set({
      ...sky,
      sunDirection,
    })
  }, [sky, sunDirection])
  useLayoutEffect(() => {
    if (environment.current) {
      drawEnvironment(environment.current, gradient, lightBoxes)
    }
  }, [gradient, lightBoxes])
  useLayoutEffect(() => {
    applyExposure(scene, renderer, environmentIntensity, exposure)
  }, [scene, renderer, environmentIntensity, exposure])
  useLayoutEffect(() => {
    const light = sunLight.current
    if (light) {
      const camera = light.shadow.camera
      Object.assign(camera, {
        left: shadow.left,
        right: shadow.right,
        bottom: shadow.bottom,
        top: shadow.top,
        near: shadow.near,
        far: shadow.far,
      })
      camera.updateProjectionMatrix()
      light.shadow.needsUpdate = true
    }
  }, [shadow])
  // Lamps glow by the preset’s gain, and the optional ones not at all with only the essential lamps, or every one with none. Their shadows fall as dark as the world tuning says. The corridor’s lanterns already light a space of their own, without any of the daylight’s fill, and daylight is no lamp.
  const {lamps, lampSet = 'all', lampShadows = 1} = preset
  useLayoutEffect(() => {
    const isLamp = (light: Light) => {
      const lamp = light as Lamp
      return Boolean(lamp.isPointLight || lamp.isSpotLight) && !lamp.userData.daylight
    }
    lightGain.current = light => {
      if (!isLamp(light)) {
        return 1
      }
      return lampSet === 'none' || lampSet === 'essential' && lampOf(light)?.optional ? 0 : lamps
    }
    lightShadow.current = light => (isLamp(light) ? lampShadows : 1)
    return () => {
      lightGain.current = () => 1
      lightShadow.current = () => 1
    }
  }, [lamps, lampSet, lampShadows])
  // Lamps only shine while the player is in one of the fences the world lights them in, like their room’s, unless selected with `?edit_lamps`, and the shadow pool’s slots only while lent to one.
  useLayoutEffect(() => {
    lightActive.current = light => {
      if (isShadowSlot(light)) {
        return shadowPool.isInUse(light)
      }
      const fences = lampOf(light)?.fences
      if (!fences) {
        return true
      }
      const {whereabouts} = useGallery.getState()
      return fences.some(fence => whereabouts.includes(fence)) || useLightEdits.getState().selected.has(light)
    }
    return () => {
      lightActive.current = () => true
    }
  }, [])
  useEffect(() => {
    if (!isDevelopmentMode) {
      return
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTextInput(event.target)) {
        return
      }
      if (event.code === lightingCycleKey) {
        notify(`Lighting: ${cycleLighting(event.shiftKey ? -1 : 1).title}`)
      }
    }
    globalThis.addEventListener('keydown', keydown)
    return () => {
      globalThis.removeEventListener('keydown', keydown)
    }
  }, [])
  const {color, intensity} = preset.sun
  return <>
    <ambientLight color={preset.ambient.color} intensity={preset.ambient.intensity} />
    <hemisphereLight color={preset.hemisphere.color} groundColor={preset.hemisphere.ground} intensity={preset.hemisphere.intensity} />
    {/* The shadow map resizes in place, but a new filter needs a new shadow, so the sun is built anew. */}
    <directionalLight key={sunShadowSamples} castShadow color={color} intensity={intensity} name='sun' position={sun.position} shadow-camera-bottom={sun.shadow.bottom} shadow-camera-far={sun.shadow.far} shadow-camera-left={sun.shadow.left} shadow-camera-near={sun.shadow.near} shadow-camera-right={sun.shadow.right} shadow-camera-top={sun.shadow.top} shadow-normalBias={sun.shadow.normalBias} userData={{marker: sunMarker}} ref={sunLight} {...sunShadow} />
  </>
}

/** With `?development`, the preset with the lighting the world tuning changed, which stays after hiding its panel. */
function useTunedLighting(preset: GalleryLightingPreset) {
  const tuning = lightingTuning.useValues()
  return useMemo(() => (isDevelopmentMode ? tuneLighting(preset, tuning, lightingTuning.initial) : preset), [preset, tuning])
}
/** The sun’s shadow props, which the world tuning of `?development` changes in heavy graphics, together with its lookups per pixel. */
function useSunShadow(mapSize: number) {
  const tuned = pipelineTuning.useValues(useShallow(state => ({
    mapSize: state.sunShadowMapSize,
    radius: state.sunShadowRadius,
    samples: state.sunShadowSamples,
  })))
  if (isDevelopmentMode && isHeavy) {
    return {
      ...getShadowProps(tuned),
      samples: tuned.samples,
    }
  }
  const sunShadow = getSunShadowSettings(graphicsProfile, mapSize)
  return {
    ...getShadowProps(sunShadow),
    samples: sunShadow.samples,
  }
}
/** Sets the scene’s environment, returning how to restore the previous one. R3F expects it to be set from an effect. */
function setEnvironment(scene: Scene, texture: CanvasTexture) {
  const previous = scene.environment
  scene.environment = texture
  return () => {
    scene.environment = previous
  }
}
/** The scene’s environment intensity and the exposure belong to the world’s lighting, like the environment itself. */
function applyExposure(scene: Scene, renderer: Renderer, environmentIntensity: number, exposure: number) {
  scene.environmentIntensity = environmentIntensity
  renderer.toneMappingExposure = exposure
}
