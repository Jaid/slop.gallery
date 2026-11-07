import type PortraitFrame from '#src/lib/frames/base/PortraitFrame.ts'
import type {Portrait} from '#src/lib/gallery.ts'
import type {Group} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import {useEffect, useRef} from 'react'

import hangingVoices from '#src/lib/audio/hangingVoices.ts'
import {playSound, useGallery} from '#src/lib/gallery.ts'
import HangingRun from '#src/lib/gallery/hanging/HangingRun.ts'
import {requestJolt, takeHanging} from '#src/lib/gallery/hanging/hangings.ts'
import JoltAnimation from '#src/lib/gallery/hanging/JoltAnimation.ts'
import {hangingNeighbors} from '#src/lib/gallery/hanging/neighbors.ts'
import world from '#src/worlds/current.ts'

/** how far in front of the wall the floor under a work is looked up, so its dust settles on the room’s floor, not on whatever lies behind the wall */
const floorProbe = 0.3

/**
 * Plays a work’s arrival on its wall once it was asked for and the work hangs there, moving its frame `art` and its `placard`, while its body already hangs still, and sounds it from where it hangs.
 * Anything taking the work off the wall, picking it up or fusing it ends the arrival at once. A jolt from a work slapped onto the wall nearby never cuts an arrival short.
 */
export default function useHanging(portrait: Portrait, frame: PortraitFrame, held: boolean, art: {current: Group | null}, placard: {current: Group | null}) {
  const run = useRef<HangingRun>(null)
  useEffect(() => () => {
    run.current?.settle(art.current, placard.current)
    run.current = null
  }, [art, placard])
  useFrame((_, delta) => {
    const still = portrait.hung && !held && !portrait.reserved && !portrait.fusing
    const request = takeHanging(portrait.id, portrait.position, portrait.rotation)
    const jolt = request?.animation instanceof JoltAnimation
    if (request && still && !(jolt && run.current?.running)) {
      run.current?.settle(art.current, placard.current)
      const [x, y, z] = portrait.position
      const current = new HangingRun(request, {
        floor: world.placement.floorHeight([x + Math.sin(portrait.rotation) * floorProbe, y, z + Math.cos(portrait.rotation) * floorProbe]),
        front: frame.front,
        height: portrait.height,
        reach: frame.reach,
        width: portrait.width,
      })
      run.current = current
      if (!jolt) {
        playSound(hangingVoices({
          impact: request.animation.impact,
          sound: frame.impactSound,
          variation: request.seed / 2 ** 31 - 1,
        }), `hanging:${request.seed}`, portrait.position)
        for (const {gap, strength, work} of hangingNeighbors(portrait, useGallery.getState().portraits)) {
          // The blow runs through the wall in a few milliseconds, the frames taking a moment more to start moving.
          requestJolt(work.id, work.position, work.rotation, portrait.position, new JoltAnimation(request.animation.impact + 0.012 + gap * 0.01, strength))
        }
      }
    }
    const current = run.current
    if (!current) {
      return
    }
    if (!still) {
      current.settle(art.current, placard.current)
      run.current = null
      return
    }
    if (!current.update(delta, art.current, placard.current)) {
      run.current = null
    }
  })
}
