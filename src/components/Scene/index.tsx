import {useFrame, useThree} from '@react-three/fiber'
import Branch from 'branch-component'
import {useEffect, useLayoutEffect, useRef} from 'react'

import AmbienceEmitterMarkers from '#component/AmbienceEmitterMarkers'
import AmbienceListener from '#component/AmbienceListener'
import FusionRemains from '#component/FusionRemains'
import Fusions from '#component/Fusions'
import ImpactSounds from '#component/ImpactSounds'
import IntroCamera from '#component/IntroCamera'
import Lamps from '#component/Lamps'
import LightLevels from '#component/LightLevels'
import LightMarkers from '#component/LightMarkers'
import Moods from '#component/Moods'
import PartyEffects from '#component/PartyEffects'
import Player from '#component/Player'
import Portraits from '#component/Portraits'
import PortraitSlotEditor from '#component/PortraitSlotEditor'
import PortraitSlots from '#component/PortraitSlots'
import Skybox from '#component/Skybox'
import SpawnedOrbs from '#component/SpawnedOrbs'
import StickySurfaces from '#component/StickySurfaces'
import WebmcpBridge from '#component/WebmcpBridge'
import {isShowingAmbienceEmitters} from '#src/lib/audio/ambience/ambienceEmitters.ts'
import {useGallery} from '#src/lib/gallery.ts'
import {useIntro} from '#src/lib/gallery/intro.ts'
import {isEditingPortraitSlots, isShowingPortraitSlots} from '#src/lib/gallery/portraitSlotStore.ts'
import {pendingRooms} from '#src/lib/gallery/roomLoading.ts'
import {useHiddenUi} from '#src/lib/hiddenUi.ts'
import {isShowingSticky} from '#src/lib/placement/showSticky.ts'
import {GalleryRenderer} from '#src/lib/rendering/GalleryRenderer.ts'
import {isShowingLamps} from '#src/lib/rendering/lightLevels.ts'
import {telemetry} from '#src/lib/telemetry/index.ts'
import {pendingImages} from '#src/lib/useArtworkTexture.ts'
import world from '#src/worlds/current.ts'

import Interaction from './Interaction.tsx'

const {Scene: WorldScene} = world

/**
 * The current world’s scene with everything every world shares. Until the world’s own scene has downloaded, it suspends the whole canvas, so the loading screen never lifts over an empty world,
 * and the render pipeline only builds once the scene is in, in the same commit, before the first frame, with the world’s sun to march.
 */
export default function Scene() {
  const uiHidden = useHiddenUi(state => state.hidden)
  const introOrbit = useIntro(state => state.orbit)
  return <>
    <WorldScene />
    <Skybox />
    <Lamps />
    <Portraits />
    <Fusions />
    <FusionRemains />
    <SpawnedOrbs />
    <PartyEffects />
    {/* Hidden with O, the markers keep working: editors still aim, drag and switch what they mark. */}
    <group name='scene-ui' visible={!uiHidden}>
      <Branch if={isShowingSticky} then={StickySurfaces} />
      <Branch if={isShowingPortraitSlots} then={PortraitSlots} />
      <Branch if={isEditingPortraitSlots} then={PortraitSlotEditor} />
      <Branch if={isShowingLamps} then={LightMarkers} />
      <Branch if={isShowingAmbienceEmitters} then={AmbienceEmitterMarkers} />
    </group>
    <Moods />
    <LightLevels />
    <AmbienceListener />
    <ImpactSounds />
    <Player />
    {/* After the Player, whose spawn releases the camera and which writes it before the intro every frame */}
    <Branch if={introOrbit !== null}><IntroCamera orbit={introOrbit!} /></Branch>
    <Interaction />
    <WebmcpBridge />
    <Ready />
  </>
}

const maxWarmup = 90_000
/**
 * Holds the loading screen until every object that the world’s culling leaves in, in the gallery only those of the start room, has been drawn once in every pass and the rooms the world asked for have mounted. The renderer streams the rest in afterward.
 * Artworks still decoding and the last pipelines, which compile one after another at about a second each, appear once they are done, with the loading indicator counting them.
 */
function Ready() {
  const frames = useRef(0)
  const loadingSince = useRef<number>(null)
  // When the artworks, the pipelines and the warmup were last done, in ms since loading began, or -1 while they aren’t. Of these, the loading screen only waits for the warmup.
  const milestones = useRef({
    images: -1,
    pipelines: -1,
    warm: -1,
  })
  /** when the next loading.progress event is due, in ms since loading began */
  const nextProgress = useRef(0)
  const renderer = useThree(state => state.renderer)
  const scene = useThree(state => state.scene)
  const galleryRenderer = renderer instanceof GalleryRenderer ? renderer : null
  useEffect(() => () => useGallery.setState({ready: false}), [])
  // A layout effect runs before the first frame draws the scene. A passive one can wait until after that frame, which then compiles every pipeline of the scene synchronously.
  useLayoutEffect(() => {
    if (!galleryRenderer) {
      return
    }
    galleryRenderer.setFrameScene(scene)
    galleryRenderer.setWarming(true)
    return () => {
      galleryRenderer.setWarming(false)
      galleryRenderer.setStreaming(false)
      galleryRenderer.setFrameScene(null)
    }
  }, [galleryRenderer, scene])
  useFrame(() => {
    if (useGallery.getState().ready) {
      return
    }
    loadingSince.current ??= performance.now()
    const elapsed = Math.round(performance.now() - loadingSince.current)
    const reached = milestones.current
    const settled = galleryRenderer?.warmedAll !== false
    reached.images = pendingImages() === 0 ? (reached.images < 0 ? elapsed : reached.images) : -1
    reached.pipelines = galleryRenderer?.pendingPipelines === 0 ? (reached.pipelines < 0 ? elapsed : reached.pipelines) : -1
    reached.warm = settled ? (reached.warm < 0 ? elapsed : reached.warm) : -1
    const warmup: Record<string, number> = galleryRenderer ? {
      'loading.warmup_build_ms': Math.round(galleryRenderer.warmup.buildMs),
      'loading.warmup_frames': galleryRenderer.warmup.frames,
      'loading.warmup_objects': galleryRenderer.warmup.objects,
    } : {}
    if (telemetry && elapsed >= nextProgress.current) {
      nextProgress.current = elapsed + 1000
      telemetry.event('loading.progress', {
        'loading.images': pendingImages(),
        'loading.ms': elapsed,
        'loading.pipelines': galleryRenderer?.pendingPipelines ?? 0,
        ...warmup,
      })
    }
    // A scene that never settles, like one that keeps adding objects, starts after a while anyway. Its last objects stream in afterward.
    const warm = settled || performance.now() - loadingSince.current > maxWarmup
    if (warm && galleryRenderer && !settled && frames.current === 0) {
      console.warn(`Pipeline warmup gave up after ${maxWarmup / 1000} s with objects still left to draw.`)
    }
    if (!warm || pendingRooms() > 0) {
      frames.current = 0
      return
    }
    if (++frames.current > 8) {
      galleryRenderer?.setWarming(false)
      galleryRenderer?.setStreaming(true)
      telemetry?.event('loading.finished', {
        'loading.images_ms': reached.images,
        'loading.ms': elapsed,
        'loading.pipelines_ms': reached.pipelines,
        'loading.warm_ms': reached.warm,
        ...warmup,
      })
      useGallery.setState({ready: true})
    }
  })
  return null
}
