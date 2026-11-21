import type {CSSProperties} from 'react'

import Branch from 'branch-component'
import clsx from 'clsx'
import {useEffect, useState} from 'react'
import {useShallow} from 'zustand/react/shallow'

import Dropzone from '#component/Dropzone'
import GraphicsTuning from '#component/GraphicsTuning'
import Hud from '#component/Hud'
import LoadingIndicator from '#component/LoadingIndicator'
import Menu from '#component/Menu'
import RenderBoundary from '#component/RenderBoundary'
import RenderError from '#component/RenderError'
import Toast from '#component/Toast'
import TuningBuffer from '#component/TuningBuffer'
import {galleryEvents, useGallery} from '#src/lib/gallery.ts'
import {useHiddenUi} from '#src/lib/hiddenUi.ts'
import {hideLoadingScreen, useLoadingScreen} from '#src/lib/loadingScreen.ts'
import {useGraphicsTuning} from '#src/lib/rendering/customGraphics.ts'
import {screenRatio} from '#src/lib/rendering/ratio.ts'
import {telemetry} from '#src/lib/telemetry/index.ts'
import useSlopGalleryTelemetry from '#src/lib/telemetry/useSlopGalleryTelemetry.ts'
import useGalleryAI from '#src/lib/useGalleryAI.ts'
import useGalleryCommands from '#src/lib/useGalleryCommands.ts'
import {currentWorldInfo} from '#src/worlds/index.ts'

import GraphicsMode from './GraphicsMode.tsx'
import World from './World.tsx'

import css from './style.module.sass'

/** the largest rectangle of the `?ratio` that fits the stage, if any */
const letterboxSize: CSSProperties | undefined = screenRatio === undefined ? undefined : {
  width: `min(100cqw, ${screenRatio * 100}cqh)`,
  height: `min(100cqh, ${100 / screenRatio}cqw)`,
}

export default function App() {
  useSlopGalleryTelemetry(telemetry, useGallery, galleryEvents)
  const settings = useGalleryAI()
  useGalleryCommands()
  const s = useGallery(useShallow(({dragging, locked, notice, ready}) => ({
    dragging,
    locked,
    notice,
    ready,
  })))
  const uiHidden = useHiddenUi(state => state.hidden)
  const tuning = useGraphicsTuning()
  const [renderFailed, setRenderFailed] = useState(false)
  const loading = useLoadingScreen(state => state.shown)
  // lib.dom types navigator.gpu as always present, but browsers without WebGPU leave it undefined.
  const gpu = (navigator.gpu as GPU | undefined) !== undefined && globalThis.isSecureContext
  // index.html covers the page with a spinner over the wallpaper while the scene loads. It fades out to the menu over the ready scene, or to the error that keeps it from rendering.
  useEffect(() => {
    if (s.ready || renderFailed || !gpu) {
      hideLoadingScreen()
    }
  }, [gpu, renderFailed, s.ready])
  if (!gpu) {
    return <RenderError><h2>WebGPU is unavailable.</h2><p>{currentWorldInfo.title} requires native WebGPU. Open it in current Chrome or Edge with hardware acceleration enabled, using HTTPS or localhost.</p></RenderError>
  }
  return <GraphicsMode><Dropzone><div className={css.layout}>
    {/* A column of its own left of the canvas and HUD, so the panel never covers the scene it tunes */}
    <Branch if={tuning.open} then={GraphicsTuning} />
    {/* ?ratio letterboxes the screen, so the canvas keeps that shape and the menu and HUD stay on it. */}
    <div className={clsx(css.stage, letterboxSize && css.letterbox)}>
      <div className={css.screen} style={letterboxSize}>
        <main className={css.viewport} aria-label='Interactive 3D gallery'>
          <RenderBoundary onFailure={() => setRenderFailed(true)}><World /></RenderBoundary>
          <Branch if={tuning.open} then={TuningBuffer} />
        </main>
        {/* Hidden with O, the paused scene stays in full view, e.g. while tweaking values in an editor; O brings the menu back. Hovering the tuning panel hides it too. The loading screen stands in for it until the scene is ready. */}
        <Branch none={[loading, s.locked, s.dragging, renderFailed, uiHidden, tuning.hovered]}><Menu {...settings} /></Branch>
        <Branch not={uiHidden} then={Hud} />
        {/* Count items that are still streaming once the initial loading screen gives way. */}
        <Branch none={[loading, uiHidden]} then={LoadingIndicator} />
        <Branch if={s.notice} not={uiHidden}><Toast>{s.notice}</Toast></Branch>
      </div>
    </div>
  </div></Dropzone></GraphicsMode>
}
