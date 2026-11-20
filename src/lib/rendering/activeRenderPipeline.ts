import type {RootStore} from '@react-three/fiber'
import type {TSLRootState} from '@react-three/tsl'
import type {RenderPipeline} from 'three/webgpu'

import {setRenderOverride} from '@react-three/fiber'

import {drawGeofenceOverlay} from './geofenceOverlay.ts'

/** Route the canvas’s default render job through `pipeline` and publish it as `state.renderPipeline` for consumers such as capture. */
export const activateRenderPipeline = (store: RootStore, pipeline: RenderPipeline) => {
  store.setState({renderPipeline: pipeline} satisfies Partial<TSLRootState>)
  setRenderOverride(store, () => {
    pipeline.render()
    drawGeofenceOverlay(store.getState().camera)
  })
}

/** Restore plain scene rendering, unless another pipeline has taken over since. */
export const releaseRenderPipeline = (store: RootStore, pipeline: RenderPipeline) => {
  if (store.getState().renderPipeline !== pipeline) {
    return
  }
  store.setState({renderPipeline: null} satisfies Partial<TSLRootState>)
  setRenderOverride(store, null)
}
