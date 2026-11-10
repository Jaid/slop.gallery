import type {MoodFade} from '../../src/moods/base/Mood.ts'
import type {MoodOutput, MoodTarget} from '../../src/moods/lib/MoodMixer.ts'
import type PlacedRoom from '../../src/worlds/base/PlacedRoom.ts'
import type {AmbienceLoop} from 'ambience-emitter'

import {afterEach, describe, expect, mock, test} from 'bun:test'

import {AmbientLight, Color, HemisphereLight, PointLight, Scene} from 'three/webgpu'

import {fusionTiming} from '../../src/lib/gallery/fusion/timing.ts'
import {orbs} from '../../src/lib/gallery/orbs/index.ts'
import {applyLightLevels, lightTint, noTint} from '../../src/lib/rendering/lightLevels.ts'
import Mood from '../../src/moods/base/Mood.ts'
import RoomMood, {roomMoodFade} from '../../src/moods/base/RoomMood.ts'
import {moods} from '../../src/moods/index.ts'
import {readMood} from '../../src/moods/lib/forcedMood.ts'
import MoodMixer, {moodFade, noMood} from '../../src/moods/lib/MoodMixer.ts'
import {moodSuppression, toggleMoodSuppression} from '../../src/moods/lib/moodSuppression.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'

/** a loop that only records what it was told */
class RecordingLoop {
  levels: Array<number> = []
  /** the time constants of every start, level and stop after the first level, which precedes any start */
  smoothings: Array<number | undefined> = []
  started = 0
  stopped = 0
  setLevel(level: number, smoothing?: number) {
    if (this.levels.length > 0) {
      this.smoothings.push(smoothing)
    }
    this.levels.push(level)
  }

  start(_output: unknown, smoothing?: number) {
    this.started++
    this.smoothings.push(smoothing)
  }

  stop(fade?: number) {
    this.stopped++
    this.smoothings.push(fade)
  }
}
const noRelease = () => {}
const transformNothing = () => noRelease
class TestMood extends Mood {
  override readonly ambience
  override readonly fade?: MoodFade
  override readonly fill = {
    color: '#808080',
    gain: 1,
  }
  override readonly grade = {
    shadow: '#000000',
    midtone: '#ff0000',
    highlight: '#ffffff',
    strength: 0.5,
  }
  override readonly lamps = {
    color: '#ff0000',
    gain: 0.5,
  }
  readonly loops: Array<RecordingLoop> = []
  readonly title: string
  override readonly transformer = mock(transformNothing)

  constructor(readonly id: string, fade?: MoodFade) {
    super()
    this.title = id
    this.fade = fade
    const {loops} = this
    this.ambience = class extends RecordingLoop {
      constructor() {
        super()
        loops.push(this)
      }
    } as unknown as new () => AmbienceLoop
  }
}
/** an engine that only records the shares the moods’ transformers take */
const engine = () => ({
  transformers: {
    transform: mock((_key: object, _transformer: unknown, _amount: number) => {}),
  },
}) as unknown as MoodOutput & {transformers: {transform: ReturnType<typeof mock<(key: object, transformer: unknown, amount: number) => void>>}}
const output = engine()
const step = 1 / 60
const cast = (mood: Mood | null, ...room: Array<Mood>): MoodTarget => ({
  cast: mood,
  room,
})
const inRoom = (...room: Array<Mood>) => cast(null, ...room)
/** Steps the mixer toward `target` for `seconds`. */
const run = (mixer: MoodMixer, target: MoodTarget, seconds: number, audio?: MoodOutput) => {
  for (let time = 0; time < seconds - 1e-9; time += step) {
    mixer.update(target, step, audio)
  }
}
/** the share the mood’s transformer was last told to take on `audio` */
const share = (audio: ReturnType<typeof engine>, mood: Mood) => audio.transformers.transform.mock.calls.findLast(([key]) => key === mood)?.[2]
describe('mood mixer', () => {
  test('a mood fades in over its fade time, tints lamps and fill apart and fades out again', () => {
    const mixer = new MoodMixer
    const mood = new TestMood('test')
    const lamp = new PointLight
    const fill = new AmbientLight
    run(mixer, cast(mood), moodFade.in / 2)
    expect(mixer.moods).toEqual([mood])
    expect(mixer.amountOf(mood)).toBeCloseTo(0.5, 1)
    run(mixer, cast(mood), moodFade.in)
    expect(mixer.amountOf(mood)).toBe(1)
    // Linear colors: red at half gain for the lamps, middle gray for the fill.
    expect(mixer.tintOf(lamp).toArray()).toEqual([0.5, 0, 0])
    const gray = new Color('#808080')
    for (const [index, channel] of mixer.tintOf(fill).toArray().entries()) {
      expect(channel).toBeCloseTo(gray.toArray()[index], 12)
    }
    run(mixer, noMood, moodFade.out + step)
    expect(mixer.amountOf(mood)).toBe(0)
    expect(mixer.tintOf(lamp).equals(noTint)).toBe(true)
    expect(mixer.moods).toEqual([])
  })
  test('switching the mood cast fades the first one out completely before the next one comes in', () => {
    const mixer = new MoodMixer
    const first = new TestMood('first')
    const second = new TestMood('second')
    run(mixer, cast(first), moodFade.in)
    run(mixer, cast(second), moodFade.out / 2)
    expect(mixer.moods).toEqual([first])
    expect(mixer.amountOf(first)).toBeGreaterThan(0)
    run(mixer, cast(second), moodFade.out / 2 + step * 2)
    expect(mixer.moods).toEqual([second])
    run(mixer, cast(second), moodFade.in)
    expect(mixer.amountOf(second)).toBe(1)
  })
  test('a mood with a pace of its own comes and goes at it, also while it gives way to another one', () => {
    const mixer = new MoodMixer
    const slow = new TestMood('slow', {
      in: 2,
      out: 1,
    })
    const next = new TestMood('next')
    run(mixer, cast(slow), 1)
    expect(mixer.amountOf(slow)).toBeCloseTo(0.5, 1)
    run(mixer, cast(slow), 1)
    expect(mixer.amountOf(slow)).toBe(1)
    run(mixer, cast(next), 0.5)
    expect(mixer.moods).toEqual([slow])
    expect(mixer.amountOf(slow)).toBeCloseTo(0.5, 1)
    run(mixer, cast(next), 0.5 + step * 2)
    expect(mixer.moods).toEqual([next])
  })
  test('a light with userData.untinted keeps its color through the mood', () => {
    const mixer = new MoodMixer
    const mood = new TestMood('test')
    const lamp = new PointLight
    const portal = new PointLight
    portal.userData.untinted = true
    run(mixer, cast(mood), moodFade.in)
    expect(mixer.tintOf(lamp).equals(noTint)).toBe(false)
    expect(mixer.tintOf(portal)).toBe(noTint)
  })
  test('the room’s moods hold beneath the one cast over the world, stacking their tints, loops and transformers', () => {
    const mixer = new MoodMixer
    const audio = engine()
    const room = new TestMood('room', roomMoodFade)
    const orb = new TestMood('orb')
    run(mixer, inRoom(room), roomMoodFade.in, audio)
    expect(mixer.amountOf(room)).toBe(1)
    run(mixer, cast(orb, room), moodFade.in, audio)
    expect(mixer.moods).toEqual([room, orb])
    expect(mixer.amountOf(room)).toBe(1)
    expect(mixer.amountOf(orb)).toBe(1)
    // Both tint the lamps: red at half gain, twice.
    expect(mixer.tintOf(new PointLight).toArray()).toEqual([0.25, 0, 0])
    expect(room.loops[0].levels.at(-1)).toBe(1)
    expect(orb.loops[0].levels.at(-1)).toBe(1)
    expect(share(audio, room)).toBe(1)
    expect(share(audio, orb)).toBe(1)
    // Letting go of the orb leaves the room as it was.
    run(mixer, inRoom(room), moodFade.out + step, audio)
    expect(mixer.moods).toEqual([room])
    expect(mixer.tintOf(new PointLight).toArray()).toEqual([0.5, 0, 0])
    expect(orb.loops[0].stopped).toBe(1)
    expect(share(audio, orb)).toBe(0)
    expect(room.loops[0].stopped).toBe(0)
    expect(share(audio, room)).toBe(1)
  })
  test('walking into another room crosses its moods over, while a mood both rooms name holds on', () => {
    const mixer = new MoodMixer
    const audio = engine()
    const left = new TestMood('left', roomMoodFade)
    const entered = new TestMood('entered', roomMoodFade)
    const shared = new TestMood('shared', roomMoodFade)
    run(mixer, inRoom(left, shared), roomMoodFade.in, audio)
    run(mixer, inRoom(entered, shared), roomMoodFade.out / 2, audio)
    expect(mixer.amountOf(left)).toBeCloseTo(0.5, 1)
    expect(mixer.amountOf(left) + mixer.amountOf(entered)).toBeCloseTo(1, 6)
    expect(share(audio, left)! + share(audio, entered)!).toBeCloseTo(1, 6)
    run(mixer, inRoom(entered, shared), roomMoodFade.out / 2 + step, audio)
    expect(mixer.moods).toEqual([shared, entered])
    expect(share(audio, left)).toBe(0)
    expect(share(audio, entered)).toBe(1)
    expect(shared.loops).toHaveLength(1)
    expect(shared.loops[0].stopped).toBe(0)
    expect(mixer.amountOf(shared)).toBe(1)
  })
  test('cutting lets every mood go at once, with its loop and transformer, ignoring its fade', () => {
    const mixer = new MoodMixer
    const audio = engine()
    const mood = new TestMood('test', {
      in: 1,
      out: 10,
    })
    const room = new TestMood('room', roomMoodFade)
    run(mixer, cast(mood, room), 1, audio)
    expect(mixer.amountOf(mood)).toBe(1)
    mixer.cut()
    expect(mixer.amountOf(mood)).toBe(0)
    expect(mixer.moods).toEqual([])
    expect(mixer.tintOf(new PointLight).equals(noTint)).toBe(true)
    expect(mood.loops[0].stopped).toBe(1)
    expect(room.loops[0].stopped).toBe(1)
    expect(share(audio, mood)).toBe(0)
    expect(share(audio, room)).toBe(0)
    mixer.cut()
    expect(mood.loops[0].stopped).toBe(1)
  })
  test('snapping shows the moods due in full at once, with their loops, and snapping to none drops them', () => {
    const mixer = new MoodMixer
    const mood = new TestMood('test', {
      in: 10,
      out: 10,
    })
    const room = new TestMood('room', roomMoodFade)
    mixer.snap(cast(mood, room), output)
    expect(mixer.amountOf(mood)).toBe(1)
    expect(mixer.amountOf(room)).toBe(1)
    expect(mixer.moods).toEqual([room, mood])
    expect(mood.loops[0].started).toBe(1)
    expect(mood.loops[0].levels.at(-1)).toBe(1)
    mixer.snap(noMood)
    expect(mixer.amountOf(mood)).toBe(0)
    expect(mixer.moods).toEqual([])
    expect(mood.loops[0].stopped).toBe(1)
    expect(room.loops[0].stopped).toBe(1)
  })
  test('without fading, moods cut in and out from one frame to the next, the cast ones swapping at once, their loops and transformers along', () => {
    const mixer = new MoodMixer({fade: false})
    const audio = engine()
    const room = new TestMood('room', roomMoodFade)
    const entered = new TestMood('entered', roomMoodFade)
    const first = new TestMood('first')
    const second = new TestMood('second')
    mixer.update(cast(first, room), step, audio)
    expect(mixer.moods).toEqual([room, first])
    expect(mixer.amountOf(room)).toBe(1)
    expect(mixer.amountOf(first)).toBe(1)
    expect(mixer.tintOf(new PointLight).toArray()).toEqual([0.25, 0, 0])
    expect(first.loops[0].levels.at(-1)).toBe(1)
    expect(share(audio, first)).toBe(1)
    mixer.update(cast(second, entered), step, audio)
    expect(mixer.moods).toEqual([entered, second])
    expect(mixer.amountOf(second)).toBe(1)
    expect(first.loops[0].stopped).toBe(1)
    expect(room.loops[0].stopped).toBe(1)
    expect(share(audio, first)).toBe(0)
    expect(share(audio, room)).toBe(0)
    expect(share(audio, entered)).toBe(1)
    // A frame without any time passing cuts just the same.
    mixer.update(noMood, 0, audio)
    expect(mixer.moods).toEqual([])
    expect(mixer.tintOf(new PointLight).equals(noTint)).toBe(true)
    for (const loop of [room, entered, first, second].flatMap(mood => mood.loops)) {
      expect(loop.smoothings.length).toBeGreaterThan(0)
      expect(loop.smoothings).toEqual(loop.smoothings.map(() => 0))
    }
    const smoothings = audio.transformers.transform.mock.calls.map(call => (call as Array<unknown>)[3])
    expect(smoothings).toEqual(smoothings.map(() => 0))
  })
  test('the loop and the transformer start once there is an output, follow the strength and stop with their mood', () => {
    const mixer = new MoodMixer
    const audio = engine()
    const mood = new TestMood('test')
    run(mixer, cast(mood), 0.3)
    expect(mood.loops).toHaveLength(0)
    run(mixer, cast(mood), moodFade.in, audio)
    expect(mood.loops).toHaveLength(1)
    const [loop] = mood.loops
    expect(loop.started).toBe(1)
    expect(loop.levels[0]).toBe(0)
    expect(loop.levels.at(-1)).toBe(1)
    expect(share(audio, mood)).toBe(1)
    run(mixer, noMood, moodFade.out + step, audio)
    expect(loop.levels.at(-1)).toBeCloseTo(0, 6)
    expect(loop.stopped).toBe(1)
    expect(share(audio, mood)).toBe(0)
    // Holding it again makes a fresh loop.
    run(mixer, cast(mood), step, audio)
    expect(mood.loops).toHaveLength(2)
    mixer.dispose()
    expect(mood.loops[1].stopped).toBe(1)
    expect(mixer.moods).toEqual([])
  })
})
describe('light tint', () => {
  afterEach(() => {
    lightTint.current = () => noTint
  })
  test('tints every light color, the hemisphere’s ground too, and returns to what the owner set', () => {
    const scene = new Scene
    const lamp = new PointLight('#ffffff', 2)
    const sky = new HemisphereLight('#4080ff', '#806040', 1)
    scene.add(lamp, sky)
    const skyColor = sky.color.clone()
    const ground = sky.groundColor.clone()
    const tint = new Color(0.5, 1, 0)
    lightTint.current = () => tint
    applyLightLevels(scene)
    expect(lamp.color.toArray()).toEqual([0.5, 1, 0])
    expect(sky.groundColor.toArray()).toEqual(ground.clone().multiply(tint).toArray())
    // Applied every frame, the tint does not compound.
    applyLightLevels(scene)
    expect(lamp.color.toArray()).toEqual([0.5, 1, 0])
    // A color the owner sets meanwhile is the new base.
    lamp.color.set('#ff0000')
    applyLightLevels(scene)
    expect(lamp.color.toArray()).toEqual([0.5, 0, 0])
    lightTint.current = () => noTint
    applyLightLevels(scene)
    expect(lamp.color.toArray()).toEqual([1, 0, 0])
    expect(sky.color.toArray()).toEqual(skyColor.toArray())
    expect(sky.groundColor.toArray()).toEqual(ground.toArray())
    expect(lamp.intensity).toBe(2)
  })
})
describe('moods', () => {
  test('every mood goes by its id, which the loop of one that sounds shares', () => {
    for (const [id, mood] of Object.entries<Mood>(moods)) {
      expect(mood.id).toBe(id)
      const {ambience: Ambience} = mood
      if (!Ambience) {
        continue
      }
      const ambience = new Ambience
      expect(ambience.playing).toBe(false)
      expect(ambience.id).toBe(`mood-${id}`)
    }
  })
  test('every orb that casts a mood casts one of its own, sharing its id, and only the Transparent Orb casts none', () => {
    const moody = orbs.filter(orb => orb.mood)
    expect(orbs.filter(orb => !orb.mood).map(orb => orb.id)).toEqual(['transparent'])
    expect(moody.map<string | undefined>(orb => orb.mood)).toEqual(moody.map(orb => orb.id))
    for (const orb of moody) {
      const mood: Mood = moods[orb.mood!]
      expect(mood.ambience).toBeDefined()
      expect(mood.grade!.strength).toBeGreaterThan(0)
      expect(mood.grade!.strength).toBeLessThanOrEqual(1)
      for (const color of [mood.grade!.shadow, mood.grade!.midtone, mood.grade!.highlight, mood.lamps!.color, mood.fill!.color]) {
        expect(color).toMatch(/^#[\da-f]{6}$/)
      }
    }
  })
  test('the fusion’s mood belongs to no orb and comes over the world while the intro plays', () => {
    expect(orbs.map(orb => orb.mood)).not.toContain('fusion')
    expect(moods.fusion.fade.in).toBe(fusionTiming.intro)
  })
  test('every room names a mood of the rooms, which comes and goes at a room’s pace, apart from the moods cast over the world', () => {
    const rooms = [slopGallery, knottingham, sandbox].flatMap<PlacedRoom>(world => world.rooms)
    expect(rooms.filter(placed => !placed.mood)).toEqual([])
    const named = [...new Set(rooms.map<string>(placed => placed.mood!))]
    const roomMoods = Object.values<Mood>(moods).filter(mood => mood instanceof RoomMood)
    // Every mood of the rooms is some room’s.
    expect(roomMoods.map(mood => mood.id).toSorted()).toEqual(named.toSorted())
    for (const mood of roomMoods) {
      expect(mood.fade).toEqual(roomMoodFade)
    }
    const castOver = ['fusion', ...orbs.flatMap(orb => orb.mood ?? [])]
    expect(Object.keys(moods).toSorted()).toEqual([...named, ...castOver].toSorted())
    expect(roomMoods.filter(mood => mood.ambience).map(mood => mood.id)).toEqual(['bastion'])
  })
  test('N suppresses every mood and lets them back', () => {
    expect(moodSuppression.active).toBe(false)
    expect(toggleMoodSuppression()).toBe(true)
    expect(moodSuppression.active).toBe(true)
    expect(toggleMoodSuppression()).toBe(false)
    expect(moodSuppression.active).toBe(false)
  })
  test('?mood names a mood by its id, a room’s too, and ignores anything else', () => {
    expect(readMood('http://localhost/?mood=horror')).toBe('horror')
    expect(readMood('http://localhost/?mood=fusion')).toBe('fusion')
    expect(readMood('http://localhost/?mood=bastion')).toBe('bastion')
    expect(readMood('http://localhost/?mood=sunshine')).toBe('')
    expect(readMood('http://localhost/?mood=toString')).toBe('')
    expect(readMood('http://localhost/')).toBe('')
  })
})
