import type {GameWrapperProps} from 'three-fiber-game'

import Branch from 'branch-component'

import AlbedoVision from '#component/AlbedoVision'
import Postprocessing from '#component/Postprocessing'
import StreamPace from '#component/StreamPace'
import TelemetryBridge from '#component/TelemetryBridge'
import TunedFov from '#component/TunedFov'
import WebgpuCaptureBridge from '#component/WebgpuCaptureBridge'
import WireframeVision from '#component/WireframeVision'
import WorldFreeze from '#component/WorldFreeze'
import {isDevelopmentMode} from '#src/lib/developmentMode.ts'
import {isShowingAlbedo} from '#src/lib/rendering/albedo.ts'
import {getAntiAliasing, readAntiAliasing} from '#src/lib/rendering/antiAliasing.ts'
import {graphicsProfile, isHeavyGraphics} from '#src/lib/rendering/graphicsMode.ts'
import {getRenderPipelineSettings} from '#src/lib/rendering/renderPipelineSettings.ts'
import {isShowingWireframe} from '#src/lib/rendering/showWireframe.ts'

const antiAliasing = getAntiAliasing(isHeavyGraphics, readAntiAliasing())
const pipelineSettings = getRenderPipelineSettings(graphicsProfile, antiAliasing)

/** Gallery integrations stay outside the physics subtree and share the WebGPU Canvas. */
export default function GameScene({children}: GameWrapperProps) {
  return <>
    <WorldFreeze />
    <StreamPace />
    <WebgpuCaptureBridge />
    <TelemetryBridge />
    <Branch if={isDevelopmentMode} then={TunedFov} />
    {children}
    {/* ?show_wireframe and ?albedo replace the regular frame, the wireframe taking precedence. */}
    <Branch if={isShowingWireframe} then={WireframeVision} />
    <Branch if={isShowingAlbedo} not={isShowingWireframe} then={AlbedoVision} />
    {/* Every graphics mode draws through the pipeline, which in Fast without antialiasing is the scene, its output transform and the moods’ screens. */}
    <Branch none={[isShowingWireframe, isShowingAlbedo]}><Postprocessing focus={graphicsProfile.postprocessing} heavy={graphicsProfile.postprocessing} settings={pipelineSettings} tunable={isDevelopmentMode && isHeavyGraphics} /></Branch>
  </>
}
