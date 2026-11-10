import type {CaptureFrameApi, CaptureRenderWrap} from '../types.ts'
import type {TSLRootState} from '@react-three/tsl'

import {useThree} from '@react-three/fiber'
import {useEffect, useRef, useState} from 'react'

import WebgpuCapture from '../WebgpuCapture.ts'

export type UseWebgpuCaptureOptions = {
  /** Wraps every capture’s render, see `WebgpuCaptureOptions`. Keep it stable: a new function reconnects the capture service. */
  around?: CaptureRenderWrap
}

const unmounted = () => Promise.reject(new Error('WebGPU capture is not mounted.'))
/** Capture the current Fiber scene and camera, including its active render pipeline. The returned API is stable. */
const useWebgpuCapture = ({around}: UseWebgpuCaptureOptions = {}): CaptureFrameApi => {
  const renderer = useThree(state => state.renderer)
  const scene = useThree(state => state.scene)
  const camera = useThree(state => state.camera)
  // The pipeline slot is defined by @react-three/tsl, whether its useRenderPipeline or the app fills it.
  const pipeline: TSLRootState['renderPipeline'] = useThree(state => state.renderPipeline)
  const captureRef = useRef<WebgpuCapture | null>(null)
  useEffect(() => {
    const capture = new WebgpuCapture({
      around,
      renderer,
      scene,
      camera,
      pipeline,
    })
    captureRef.current = capture
    return () => {
      captureRef.current = null
      capture.dispose()
    }
  }, [around, camera, pipeline, renderer, scene])
  const [api] = useState<CaptureFrameApi>(() => ({
    captureFrame: () => captureRef.current?.captureFrame() ?? unmounted(),
    capturePixels: () => captureRef.current?.capturePixels() ?? unmounted(),
  }))
  return api
}

export default useWebgpuCapture
