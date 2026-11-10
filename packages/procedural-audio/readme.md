# procedural-audio

Sound effects synthesized with Web Audio from plain recipes: no recordings, no downloads, no generated assets. A recipe is a list of voices, each an oscillator or filtered noise with an envelope, and `playVoices` schedules it on any audio context, live or offline.

```typescript
import playVoices, {noise, osc} from 'procedural-audio'

const context = new AudioContext
const output = {
  context,
  master: context.destination,
}

const knock = [
  osc(165, 0.16, 0.042, {endFrequency: 49}),
  noise(0.045, 0.02, {
    type: 'lowpass',
    frequency: 980,
    endFrequency: 320,
  }),
]

playVoices(output, knock)
```

No dependencies. Recipes are data, so they can be built from game state, like a footstep from the walking speed and the ground, compared in tests and rendered into an `OfflineAudioContext` to measure them.

## Voices

`osc(frequency, duration, volume, options?)` is a tone, a sine unless `type` says otherwise. `noise(duration, volume, filter, options?)` is white noise through a filter. Both rise within `attack` seconds (3 ms by default) and fall exponentially to silence by their end, which keeps even the shortest click free of pops.

| Field | Voices | Description |
| --- | --- | --- |
| `duration` | both | seconds from its onset to silence |
| `volume` | both | the peak of its envelope |
| `delay` | both | seconds after the recipe starts until it sets in |
| `attack` | both | seconds it takes to rise to its volume |
| `frequency`, `endFrequency` | tone | its pitch in hertz, and the pitch it glides to exponentially by its end |
| `type` | tone | the oscillator’s waveform |
| `filter` | both, required for noise | a biquad filter by `type`, `frequency` and `q`, which may glide to `endFrequency` |

`shiftVoices(voices, seconds)` delays a whole recipe, to string several into one playback, and `scaleVoices(voices, factor)` scales its volume. Both return a new recipe.

## Playing

`playVoices(output, voices, options?)` plays a recipe from now on into `output.master` and returns a playback.

| Option | Default | Description |
| --- | --- | --- |
| `seed` | `''` | what the recipe’s noise is made from: the same seed makes the same noise, sample by sample, and another one tells two sounds of the same recipe apart |
| `gain` | `1` | the level of the whole playback |
| `duration` | the recipe’s | fits the entire recipe, delays included, to this many seconds |
| `sustain` | `false` | holds the envelopes and loops the noise until the playback is stopped |
| `position` | none | where the sound is heard from; without one it plays right where the listener is |
| `hearing` | `{near: 2, far: 26}` | how far a positioned sound carries |
| `onEnded` | none | called once every voice has ended and the playback released its nodes |

The playback has `gain`, an `AudioParam` to automate, and `stop(fade?)`, which fades out within `fade` seconds, 0.025 by default. A playback owns all of its nodes and disconnects them once it has ended or was stopped. It never disconnects the output or touches the context.

## Sounds in space

With a `position`, a playback is heard through an HRTF panner at full level within `hearing.near` meters, fading linearly to silence at `hearing.far`. Distance takes the highs before it takes the level: a lowpass after the panner closes from 18 kHz nearby toward a muffled 2.2 kHz at the edge of hearing, quickly at first, by where the context’s listener stands as the sound starts.

```typescript
playVoices(output, knock, {
  seed: 'door',
  position: [4, 1, -2],
  hearing: {
    near: 2,
    far: 26,
  },
})
```

Move `context.listener` along with the camera, and positioned sounds are heard from there. The pieces are exported for sounds of other kinds: `hearingPath(context, position, hearing, cutoff?)` makes the panner and its lowpass, `hearingShare(position, listener, hearing)` tells how far, 0–1, a listener is on a sound’s way from `near` to `far`, `absorptionCutoff(share)` the lowpass’ cutoff there, and `listenerPosition(context)` where the listener stands.

## Helpers

- `atContextTime(context, time, callback)` calls back once the context’s own clock reaches a time and returns how to cancel it. Unlike a timer on the wall clock, it is on time for a context that renders slower or faster than real time, like an offline one, and waits with a suspended one. Use it for whatever has to happen once sound has rung out, like disconnecting nodes.
- `whiteNoise(context)` is a buffer of a few seconds of white noise shared by everything in a context, to loop or to start somewhere at random.
- `swayCurve(context, rate)` is a buffer of smooth random values from 0 to 1 that loops without a seam, with `rate` new targets per second, to modulate a level or a filter with.
