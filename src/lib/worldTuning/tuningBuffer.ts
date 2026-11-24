import type {RgbaFrame} from 'webgpu-capture-bridge'

import {create} from 'zustand'

/** how long the panel’s values must rest before the next change starts a new tweak, which captures the frame before it, so a slider drag captures once */
const tweakGap = 500

/** The frame from before the latest tweak in the world tuning panel, which holding Space over the panel shows in place of the live view. There is one at most, and hiding the panel drops it. */
export const useTuningBuffer = create<{
  frame?: RgbaFrame
  showing: boolean
}>(() => ({showing: false}))

let lastChange = Number.NEGATIVE_INFINITY
let capturing: Promise<void> | undefined
/** counts discards, so a capture that finishes after one doesn’t bring the frame back */
let generation = 0

/** Applies a change the panel makes to the world tuning, first capturing the live frame if the change starts a new tweak. Changes that come in during the capture wait for it, in order, so `apply` must not read the event that asked for it, which has ended by then. */
export function changeWorldTuning(apply: () => void) {
  const now = performance.now()
  const startsTweak = now - lastChange > tweakGap
  lastChange = now
  if (startsTweak && !capturing) {
    capturing = captureTuningBuffer().finally(() => {
      capturing = undefined
    })
  }
  if (capturing) {
    // A change that throws reports like one applied right away would.
    capturing.then(apply).catch(reportError)
    return
  }
  apply()
}

/** Drops the frame. */
export function discardTuningBuffer() {
  generation++
  useTuningBuffer.setState({
    frame: undefined,
    showing: false,
  })
}

async function captureTuningBuffer() {
  const capturePixels = globalThis.slopGallery?.capturePixels
  if (!capturePixels) {
    return
  }
  const capturedGeneration = generation
  try {
    const frame = await capturePixels()
    if (capturedGeneration === generation) {
      useTuningBuffer.setState({frame})
    }
  } catch (error) {
    // Comparing is a convenience; the change goes through either way.
    console.warn('Could not capture the frame before the world tuning tweak.', error)
  }
}
