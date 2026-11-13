import {egoControls} from 'ego-player'
import {useEffect, useState} from 'react'
import Game from 'three-fiber-game'
import {useGraphicsModeValue} from 'use-graphics-mode'
import usePauseMenu from 'use-pause-menu'

import Scene from '#component/Scene'
import SoundEngine from '#src/lib/audio/SoundEngine.ts'
import {useGallery} from '#src/lib/gallery.ts'
import {playerSession} from '#src/lib/gallery/PlayerSession.ts'
import pauseMenu, {shouldFreezeWorld} from '#src/lib/pauseMenu.ts'
import {isShowingAlbedo} from '#src/lib/rendering/albedo.ts'
import {useRenderScale} from '#src/lib/rendering/captureWarmup.ts'
import {defaultFov} from '#src/lib/rendering/customGraphics.ts'
import {readFov} from '#src/lib/rendering/fov.ts'
import {createGalleryRenderer} from '#src/lib/rendering/GalleryRenderer.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import {readNear} from '#src/lib/rendering/near.ts'
import {useZoomIndependentDpr} from '#src/lib/rendering/scale.ts'

import GamePhysics from './GamePhysics.tsx'
import GameScene from './GameScene.tsx'

export default function World() {
  const profile = useGraphicsModeValue(getGraphicsProfile)
  const {stage} = usePauseMenu(pauseMenu)
  const freezeWorld = shouldFreezeWorld(stage)
  const soundOn = useGallery(state => state.sound)
  // The permalink’s scale, unless the tuning panel of `?development` changed it or a capture still warms up.
  const dpr = useZoomIndependentDpr(useRenderScale())
  const [initial] = useState(() => playerSession.snapshot())
  const [near] = useState(() => readNear())
  const [fov] = useState(() => readFov() ?? defaultFov)
  // ?albedo shows no shadows, so their maps would only cost time.
  const shadows = profile.shadows && !isShowingAlbedo
  useEffect(() => {
    const engine = SoundEngine.existing()
    if (!engine) {
      return
    }
    engine.mute(freezeWorld || !soundOn)
  }, [freezeWorld, soundOn])
  return <Game
    camera={{
      fov,
      position: [initial.position[0], initial.position[1] + 1.6, initial.position[2]],
      ...near === undefined ? {} : {near},
    }} controls={egoControls} dpr={dpr} frameloop={freezeWorld ? 'never' : 'always'} renderer={createGalleryRenderer} sceneWrapper={GameScene} shadows={shadows}
  ><GamePhysics paused={freezeWorld}><Scene /></GamePhysics></Game>
}
