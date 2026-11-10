# ambience-emitter

Endlessly looping ambient sounds, synthesized live with Web Audio: a fountain, a log fire, wind through a gate, the hum of a machine. Nothing is recorded or downloaded, and no two minutes sound the same.

A sound is a class that declares what it is made of: beds of filtered noise and held tones whose levels sway at random, and one-shots like drops, crackles and moans scattered over time.

```typescript
import type {NoiseBed, Range} from 'ambience-emitter'

import AmbienceEmitter from 'ambience-emitter'

const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'bandpass',
    frequency: 1300,
    stages: 2,
    volume: 0.035,
    sway: [3, 0.35],
    drift: [0.6, 450],
  },
]
const drops = {
  rate: 30,
  frequency: [450, 3200] as Range,
  duration: [0.012, 0.045] as Range,
}

class Fountain extends AmbienceEmitter {
  constructor() {
    super({
      id: 'fountain',
      title: 'Fountain',
      position: [0, 3, 0],
      hearing: {
        near: 1,
        far: 21,
      },
      gain: 0.3,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(drops.rate, from, until)) {
      const frequency = this.vary(drops.frequency)
      this.chirp(time, this.vary(drops.duration), 0.03, frequency, frequency * 1.5)
    }
  }
}
```

```typescript
const context = new AudioContext
const fountain = new Fountain

fountain.start({
  context,
  master: context.destination,
})
```

It builds on [procedural-audio](../procedural-audio), whose `AudioOutput` it sounds on.

## AmbienceLoop

`AmbienceLoop` is the sound itself, centered on its output, for ambience that is everywhere, like the mood of a room. Constructing one is silent.

| Member | Description |
| --- | --- |
| `start(output, smoothing?)` | builds its graph on the output and fades in; does nothing while already playing |
| `stop(fade?)` | fades out and releases every node once it has rung out |
| `setLevel(level, smoothing?)` | how loud it sounds, 0–1 of its `gain`; kept while stopped, for the next start |
| `playing` | whether it is started |
| `id`, `title`, `gain` | what the constructor got |

Subclasses override what it is made of:

- `beds`: looping noise through a filter (`filter`, `frequency`, `q`). `stages` chains identical filters, each steepening the slope by 12 dB per octave, `sway` is how fast (per second) and how deep (0–1) its level sways along a smooth random curve, and `drift` how fast and how far up (in cents) its filter wanders, so a narrow band moves like wind instead of standing like a whistle.
- `tones`: held oscillators, optionally doubled `beat` hertz higher so the two beat against each other, with the same `sway`.
- `schedule(from, until)`: called for one window of the context’s time after the other, a quarter of a second ahead, to place the one-shots that fall into it.

Within `schedule`, `scatter(rate, from, until)` yields random times averaging `rate` per second, a Poisson process, which has no memory, so windows need no shared state. `vary(range)` is a random value within a range. The one-shots are `chirp` (a sine sweeping as it decays, like a drop), `burst` (band-passed noise, like a crackle, or a breath with a long attack) and `swell` (a tone that rises slowly and dies away while gliding, optionally with vibrato, like a moan or a whistle).

## AmbienceEmitter

`AmbienceEmitter` is a loop at a `position`, heard through an HRTF panner at full level within `hearing.near` meters and fading linearly to silence at `hearing.far`. The farther away the listener, the more of its highs the air takes, so a fountain far away softens into a distant wash instead of hissing like one at arm’s length.

Tell it where the listener is whenever that changes, like every frame. A listener standing still schedules nothing.

```typescript
fountain.hear([camera.x, camera.y, camera.z], {room: 'lobby'})
```

| Member | Description |
| --- | --- |
| `hear(listener, options?)` | muffles it by the listener’s distance and, given the listener’s `room`, disables it outside its rooms; with `fading: false` both follow at once instead of gliding, like after a teleport |
| `strengthAt(listener, room?)` | how loud it reaches a listener there, 0–1, for debug views |
| `isInside(room)` | whether it sounds in that room |
| `position`, `hearing`, `rooms` | what the constructor got |

`rooms` are the IDs of the places an emitter sounds in. While the listener is anywhere else, it fades to silence, which keeps a fire from being heard through a wall. Without `rooms` it sounds everywhere, and without a `room` given to `hear` it stays as it is. The panner itself reads the listener from the context, so move `context.listener` along with the camera too.
