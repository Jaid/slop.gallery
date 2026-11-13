import type {GameWrapperProps} from 'three-fiber-game'

import Branch from 'branch-component'
import {useMemo, useState} from 'react'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import AlbedoVision from '#component/AlbedoVision'
import Postprocessing from '#component/Postprocessing'
import TelemetryBridge from '#component/TelemetryBridge'
import WebgpuCaptureBridge from '#component/WebgpuCaptureBridge'
import WireframeVision from '#component/WireframeVision'
import {isDevelopmentMode} from '#src/lib/developmentMode.ts'
import {isShowingAlbedo} from '#src/lib/rendering/albedo.ts'
import {getAntiAliasing, readAntiAliasing} from '#src/lib/rendering/antiAliasing.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import {getRenderPipelineSettings} from '#src/lib/rendering/renderPipelineSettings.ts'
import {isShowingWireframe} from '#src/lib/rendering/showWireframe.ts'

import WorldPause from './WorldPause.tsx'

/** Gallery integrations stay outside the physics subtree and share the WebGPU Canvas. */
export default function GameScene({children}: GameWrapperProps) {
  const isHeavy = useGraphicsMode()
  const profile = useGraphicsModeValue(getGraphicsProfile)
  const [requestedAntiAliasing] = useState(() => readAntiAliasing())
  const antiAliasing = getAntiAliasing(isHeavy, requestedAntiAliasing)
  const settings = useMemo(() => getRenderPipelineSettings(profile, antiAliasing), [profile, antiAliasing])
  return <>
    <WorldPause />
    <WebgpuCaptureBridge />
    <TelemetryBridge />
    {children}
    {/* ?show_wireframe and ?albedo replace the regular frame, the wireframe taking precedence. */}
    <Branch if={isShowingWireframe} then={WireframeVision} />
    <Branch if={isShowingAlbedo} not={isShowingWireframe} then={AlbedoVision} />
    <Branch if={profile.postprocessing || antiAliasing !== false} none={[isShowingWireframe, isShowingAlbedo]}><Postprocessing focus={profile.postprocessing} heavy={profile.postprocessing} settings={settings} tunable={isDevelopmentMode && isHeavy} /></Branch>
  </>
}
