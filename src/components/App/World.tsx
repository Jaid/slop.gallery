import {egoControls} from 'ego-player'
import {useState} from 'react'
import Game from 'three-fiber-game'

import Scene from '#component/Scene'
import {playerSession} from '#src/lib/gallery/PlayerSession.ts'
import {useRenderScale} from '#src/lib/rendering/captureWarmup.ts'
import {defaultFov, readFov} from '#src/lib/rendering/fov.ts'
import {createGalleryRenderer} from '#src/lib/rendering/GalleryRenderer.ts'
import {shadowsEnabled} from '#src/lib/rendering/graphicsMode.ts'
import {readNear} from '#src/lib/rendering/near.ts'
import {useZoomIndependentDpr} from '#src/lib/rendering/scale.ts'

import GamePhysics from './GamePhysics.tsx'
import GameScene from './GameScene.tsx'

export default function World() {
  // The permalink’s scale, unless the world tuning of `?development` changed it or a capture still warms up.
  const dpr = useZoomIndependentDpr(useRenderScale())
  const [initial] = useState(() => playerSession.snapshot())
  const [near] = useState(() => readNear())
  const [fov] = useState(() => readFov() ?? defaultFov)
  return <Game
    camera={{
      fov,
      position: [initial.position[0], initial.position[1] + 1.6, initial.position[2]],
      ...near === undefined ? {} : {near},
    }} controls={egoControls} dpr={dpr} renderer={createGalleryRenderer} sceneWrapper={GameScene} shadows={shadowsEnabled}
  ><GamePhysics><Scene /></GamePhysics></Game>
}
