import type {FrameFormat} from '#src/lib/downloadFrame.ts'
import type {SeedInput} from '#src/lib/webmcp/changeSeed.ts'

import {useThree} from '@react-three/fiber'
import {applyWireframeFlood} from 'capture-session'
import {AimInspector} from 'ego-player'
import {useEffect, useLayoutEffect, useRef} from 'react'
import {Vector2} from 'three/webgpu'
import useGraphicsMode, {useCinematicGraphics} from 'use-graphics-mode'

import downloadFrame from '#src/lib/downloadFrame.ts'
import {usePortraitSlots} from '#src/lib/gallery/portraitSlotStore.ts'
import {loadingItems} from '#src/lib/loadingItems.ts'
import {captureWarmup, getRenderScale} from '#src/lib/rendering/captureWarmup.ts'
import {telemetry} from '#src/lib/telemetry/index.ts'
import {playerDumps, snapshotPlayerDump} from '#src/lib/telemetry/recordPlayerDump.ts'
import addDrawing from '#src/lib/webmcp/addDrawing.ts'
import addPortrait from '#src/lib/webmcp/addPortrait.ts'
import analyzeWorld from '#src/lib/webmcp/analyzeWorld.ts'
import castMood from '#src/lib/webmcp/castMood.ts'
import changeSeed from '#src/lib/webmcp/changeSeed.ts'
import dumpPortraits from '#src/lib/webmcp/dumpPortraits.ts'
import getGeofences from '#src/lib/webmcp/getGeofences.ts'
import registerWebmcp from '#src/lib/webmcp/register.ts'
import setGraphicsQuality from '#src/lib/webmcp/setGraphicsQuality.ts'
import showFence from '#src/lib/webmcp/showFence.ts'
import {dumpSloperator, spawnSloperator, triggerSloperatorSighting} from '#src/lib/webmcp/sloperator.ts'
import spawnOrb from '#src/lib/webmcp/spawnOrb.ts'
import spawnPartyEffect from '#src/lib/webmcp/spawnPartyEffect.ts'
import throwProp from '#src/lib/webmcp/throwProp.ts'
import world from '#src/worlds/current.ts'

export default function WebmcpBridge() {
  const scene = useThree(s => s.scene)
  const camera = useThree(s => s.camera)
  const renderer = useThree(s => s.renderer)
  // the graphics the scene has switched to, which lag behind the session’s by a commit
  const graphics = useGraphicsMode.getName(useGraphicsMode(), useCinematicGraphics())
  const shownGraphics = useRef(graphics)
  useLayoutEffect(() => {
    shownGraphics.current = graphics
  }, [graphics])
  useEffect(() => {
    const controller = new AbortController
    const inspector = new AimInspector(scene, camera)
    const bridge = {
      addDrawing,
      addPortrait,
      analyzeWorld: () => analyzeWorld(scene, world.worldRooms(), room => world.fencesIn(room)),
      castMood,
      downloadFrame: async ({name, format}: {
        format?: FrameFormat
        name?: string
      }) => {
        // Dump first, like X: the frame then shows the pose the dump describes.
        const capture = playerDumps.capture?.()
        const dump = capture ? snapshotPlayerDump(capture) : null
        const download = await downloadFrame({
          name: name ?? (dump ? `${world.id}-${dump.id}` : undefined),
          format,
        })
        return {
          ...download,
          dump,
        }
      },
      dumpGeofences: () => world.dumpGeofences(),
      dumpSloperator,
      endWarmup: async () => {
        const warmed = captureWarmup.end()
        // World hands Fiber the regular pixel ratio when it renders again, which takes no animation frame, so this also resolves under a stopped virtual clock.
        const pixelRatio = getRenderScale() * devicePixelRatio
        const deadline = Date.now() + 10_000
        while (renderer.getPixelRatio() !== pixelRatio) {
          if (Date.now() > deadline) {
            throw new Error(`The canvas still renders at a pixel ratio of ${renderer.getPixelRatio()} instead of ${pixelRatio}.`)
          }
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        const size = renderer.getDrawingBufferSize(new Vector2)
        return {
          warmed,
          width: size.x,
          height: size.y,
        }
      },
      getAim: () => inspector.getAim(),
      getGeofences,
      getKnots: () => world.dumpKnots(),
      getLoadingItems: loadingItems,
      getPortraits: dumpPortraits,
      getPortraitSlots: () => usePortraitSlots.getState().slots,
      setGraphicsQuality: async (input: Parameters<typeof setGraphicsQuality>[0]) => {
        const change = setGraphicsQuality(input)
        // The scene commits on React’s own schedule, which takes no animation frame, so this also resolves under a stopped virtual clock.
        const deadline = Date.now() + 10_000
        while (shownGraphics.current !== change.quality) {
          if (Date.now() > deadline) {
            throw new Error(`The scene still shows ${shownGraphics.current} graphics instead of ${change.quality}.`)
          }
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        return change
      },
      rerollSeed: () => changeSeed(null),
      setSeed: ({seed}: SeedInput) => changeSeed(seed),
      setWireframe: applyWireframeFlood,
      showFence,
      spawnOrb,
      spawnPartyEffect,
      spawnSloperator,
      throwProp: (input: Parameters<typeof throwProp>[1]) => throwProp(camera, input),
      triggerSloperatorSighting,
      getTelemetry: () => {
        if (!telemetry) {
          return null
        }
        return {
          sessionId: telemetry.sessionId,
          collection: telemetry.collectionStatus(),
          delivery: telemetry.status(),
        }
      },
    }
    let unregister = () => {}
    async function register() {
      try {
        const cleanup = await registerWebmcp(() => bridge, controller.signal)
        if (controller.signal.aborted) {
          cleanup()
        } else {
          unregister = cleanup
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Could not register gallery WebMCP tools:', error)
        }
      }
    }
    // eslint-disable-next-line typescript/no-floating-promises -- Registration handles errors internally; effects cannot await it.
    void register()
    return () => {
      controller.abort()
      unregister()
    }
  }, [scene, camera, renderer])
  return null
}
