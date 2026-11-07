import type {MoodTarget} from '#src/lib/moods/MoodMixer.ts'

import {useFrame} from '@react-three/fiber'
import {useLayoutEffect, useRef, useState} from 'react'

import {propObjects} from '#src/components/Scene/GrabbableProp.tsx'
import SoundEngine from '#src/lib/audio/SoundEngine.ts'
import {isFading} from '#src/lib/fade.ts'
import {useGallery} from '#src/lib/gallery.ts'
import {useFusions} from '#src/lib/gallery/fusion/fusions.ts'
import {forcedMood} from '#src/lib/moods/forcedMood.ts'
import {fusionMood} from '#src/lib/moods/index.ts'
import MoodMixer from '#src/lib/moods/MoodMixer.ts'
import {moodSuppression} from '#src/lib/moods/moodSuppression.ts'
import {lightTint, noTint} from '#src/lib/rendering/lightLevels.ts'
import world from '#src/worlds/current.ts'

/** the mood a prop casts, by its id, if it is one */
const moodOf = (id: string | null) => (id ? propObjects.get(id)?.mood : undefined)

/**
 * Lets moods come over the world and leave it again: those of the room the player is in, and over them the one cast over the world, the fusion’s while any fusion’s portal is open, otherwise that of the prop the player holds or views with V until it is let go of or V released, with `?mood` that mood all the time.
 * Under `?fade=false`, they cut in and out instead of fading, for captures right after the camera jumped from room to room.
 * None show while suppressed with N under `?development`, which cuts the moods showing off at once and, when lifted, brings the moods due back in full at once.
 * Their loops and transformers sound once the sound engine exists, which only happens with the player’s first click.
 */
export default function Moods() {
  const [mixer] = useState(() => new MoodMixer({fade: isFading}))
  const suppressed = useRef(false)
  useLayoutEffect(() => {
    lightTint.current = light => mixer.tintOf(light)
    return () => {
      lightTint.current = () => noTint
      mixer.dispose()
    }
  }, [mixer])
  useFrame((_, delta) => {
    if (moodSuppression.active) {
      suppressed.current = true
      mixer.cut()
      return
    }
    const {held, inspecting, room} = useGallery.getState()
    const fusing = useFusions.getState().fusions.length > 0
    const target: MoodTarget = {
      cast: forcedMood ?? (fusing ? fusionMood : null) ?? moodOf(held) ?? moodOf(inspecting) ?? null,
      room: world.roomById(room)?.moods ?? [],
    }
    if (suppressed.current) {
      suppressed.current = false
      mixer.snap(target, SoundEngine.existing())
      return
    }
    mixer.update(target, delta, SoundEngine.existing())
  })
  return null
}
