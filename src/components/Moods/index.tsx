import type {Mood, MoodId} from '#src/moods/index.ts'
import type {MoodTarget} from '#src/moods/lib/MoodMixer.ts'

import {useFrame} from '@react-three/fiber'
import {useLayoutEffect, useRef, useState} from 'react'

import {propObjects} from '#src/components/Scene/GrabbableProp.tsx'
import SoundEngine from '#src/lib/audio/SoundEngine.ts'
import {isFading} from '#src/lib/fade.ts'
import {cameraPose, useGallery} from '#src/lib/gallery.ts'
import {useFusions} from '#src/lib/gallery/fusion/fusions.ts'
import {lightTint, noTint} from '#src/lib/rendering/lightLevels.ts'
import {getPlayerZoom} from '#src/lib/rendering/playerView.ts'
import {moods} from '#src/moods/index.ts'
import {forcedMood} from '#src/moods/lib/forcedMood.ts'
import {moodLens} from '#src/moods/lib/MoodLens.ts'
import MoodMixer from '#src/moods/lib/MoodMixer.ts'
import {moodSuppression} from '#src/moods/lib/moodSuppression.ts'
import world from '#src/worlds/current.ts'

/** the mood a prop casts, by the prop’s id, if it casts one */
const moodOf = (id: string | null) => {
  const mood = id ? propObjects.get(id)?.mood : undefined
  return mood && moods[mood]
}
/** every mood as the moods of a room that names it, so asking for them every frame makes nothing new */
const roomMoods = Object.fromEntries(Object.entries(moods).map(([id, mood]) => [id, [mood]])) as unknown as Record<MoodId, ReadonlyArray<Mood>>
const noMoods: ReadonlyArray<Mood> = []

/**
 * Lets moods come over the world and leave it again: that of the room the player is in, and over it the one cast over the world, the fusion’s while any fusion’s portal is open, otherwise that of the prop the player holds or views with V until it is let go of or V released, with `?mood` that mood all the time.
 * Under `?fade=false`, they cut in and out instead of fading, for captures right after the camera jumped from room to room.
 * None show while suppressed with N under `?development`, which cuts the moods showing off at once and, when lifted, brings the moods due back in full at once.
 * Their loops and transformers sound once the sound engine exists, which only happens with the player’s first click.
 * What they widen the player’s view by only applies while it is drawn, each frame and every capture, see `MoodLens`.
 */
export default function Moods() {
  const [mixer] = useState(() => new MoodMixer({fade: isFading}))
  const suppressed = useRef(false)
  useLayoutEffect(() => {
    lightTint.current = light => mixer.tintOf(light)
    return () => {
      lightTint.current = () => noTint
      mixer.dispose()
      moodLens.reset()
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
    const roomMood = world.roomById(room)?.mood
    const target: MoodTarget = {
      cast: forcedMood ?? (fusing ? moods.fusion : null) ?? moodOf(held) ?? moodOf(inspecting) ?? null,
      room: roomMood ? roomMoods[roomMood] : noMoods,
    }
    if (suppressed.current) {
      suppressed.current = false
      mixer.snap(target, SoundEngine.existing())
      return
    }
    mixer.update(target, delta, SoundEngine.existing())
  })
  // After every regular frame callback, so whatever sets the camera’s field of view this frame has set it, and given back once the frame is drawn.
  useFrame(({camera}, delta) => {
    moodLens.update(mixer.fov, {
      delta,
      exact: cameraPose.posed,
      fading: isFading,
      own: !cameraPose.focused,
      zoom: getPlayerZoom(),
    })
    moodLens.widen(camera)
  }, {before: 'render'})
  useFrame(() => {
    moodLens.restore()
  }, {phase: 'finish'})
  return null
}
