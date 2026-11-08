# use-narrator

One application-owned narrator for recorded audio and text-to-speech, with queued playback, explicit interruption policies, completion memory and React subscriptions. Scheduling lives in the independently usable `use-audio-queue` workspace nested under `packages/use-narrator/packages/use-audio-queue`.

```ts
import {Narrator} from 'use-narrator/core'

export const narrator = new Narrator({
  gap: 0.15,
  prependedSilence: 0.12,
  appendedSilence: 0.5,
  audio: {volume: 0.85},
  onError: (error, narration) => console.error(narration.title, error),
})

narrator.push({audio: '/announcements/welcome.opus', title: 'Welcome'})
narrator.push('This is spoken text.', {title: 'A note'})
narrator.push({audio: '/announcements/notice.opus'}, {priority: 'inject'})
```

A **bare string means text**, not an audio URL. String URLs must be wrapped in `{audio: url}`. A `URL` or `Blob` can be passed directly. `{audio, title, text}` additionally supplies readable text and enables browser-speech fallback if the recording fails. Omitting `text` makes a missing recording fail silently except for `onError`; it never triggers paid speech generation.

## Priorities

| Priority | Behavior |
| --- | --- |
| `normal` | FIFO at the end of the serialized queue. This is the default. |
| `high` | FIFO ahead of pending normal entries, but does not interrupt the current entry or an injected interruption chain. |
| `destructive` | Cancels all owned current, pending, interrupted **and concurrent** entries, then starts the new entry. |
| `inject` | Pauses the current entry and resumes it afterward. Nested injections unwind in last-in, first-out order before pending high/normal entries. |
| `async` | Starts independently of the serialized lane. Overlap is explicit rather than accidental. |
| `volatile` | Queues at normal FIFO priority. Once current, the next accepted request cancels it permanently instead of letting it resume. |
| `shy` | Skips immediately when any lane is occupied. Otherwise plays until completion or until another accepted request arrives, then is cancelled permanently. |

Immediate priorities preempt immediately, but still honor configured leading silence and the minimum serialized gap. A deduplicated push does not count as a new request. No priority bypasses a disabled narrator.

## Timing and the indicator

All times are **seconds**. The three properties are mutable:

```ts
narrator.gap = 0.2
narrator.prependedSilence = 0.15
narrator.appendedSilence = 0.3
```

`prependedSilence` begins after preparation, before audible playback; `appendedSilence` retains the entry after its sound ends. Leading and trailing padding are captured when an entry is pushed and can be overridden per push. Injection freezes unconsumed padding rather than letting it expire while another entry is displayed. Resuming a playing recording does not prepend silence again.

`gap` is the minimum interval between serialized sounds stopping and starting. Padding already contributes to that interval: it is not added to the gap twice. For example, a 0.3-second trailing silence and 0.2-second leading silence already satisfy a 0.4-second gap. The current gap setting is used when the next transition is scheduled; changing it does not rewrite a timer already running. Concurrent entries have their own padding but do not participate in the serialized gap.

`narrationState()` projects a snapshot into one primary indicator state. The foreground entry takes precedence; when only concurrent entries exist, it shows the newest one. `narrationStates()` returns every visible narration instead: serialized foreground first, followed by all concurrent `async` entries. Each state has a unique `instanceId` for React keys and per-playback instrumentation. The status is `preparing`, `before`, `playing` or `after`; `source` is `audio`, `browser` or `null`. Timed phases also expose `statusEndsAt`, the queue-clock deadline, so time-based indicator details such as the lingering audio bars can end exactly with the phase.

```tsx
import useNarrator, {narrationStates} from 'use-narrator'
import {narrator} from './narration.ts'

export function NarratorIndicators() {
  const states = narrationStates(useNarrator(narrator))
  return states.map(state => <aside key={state.instanceId} role='status'>{state.title} · {state.status}</aside>)
}
```

The hook only subscribes. Mounting/unmounting one indicator does not create, stop or dispose the shared narrator. The `core` entry point has no React dependency and does not access browser audio APIs until playback is requested.

## Ownership, cancellation and completion

```ts
const owner = new AbortController()
const handle = narrator.push({audio: '/voice.opus'}, {signal: owner.signal})

handle.cancel('No longer relevant')
// Or cancel all requests belonging to this owner:
owner.abort()

const result = await handle.finished
// {status: 'completed'}
// {status: 'cancelled', reason}
// {status: 'skipped', reason: 'busy' | 'disabled' | 'remembered'}
// {status: 'failed', error}
```

Handles resolve after trailing silence, not merely when sound starts. Cancellation and errors are result values, so a fire-and-forget push does not create an unhandled rejected promise. `onError` is called for failed entries; `onFallback` reports a recoverable switch of speech backend. A failed entry releases its slot and the queue continues.

`key` deduplicates unfinished entries and returns the original handle, whose options and ownership remain authoritative. `once` adds narrator-lifetime completion memory and an automatic key. Interrupted, skipped and failed entries are not marked heard. `repeat: true` bypasses completion memory but retains in-flight deduplication. `hasSpoken(key)`, `forget(key)` and `clearHistory()` expose explicit memory control.

```ts
narrator.push({audio: modelUrl, title: modelTitle}, {once: modelId})
narrator.push({audio: knotUrl, title: knotTitle}, {once: knotId})
narrator.push({audio: knotUrl, title: knotTitle}, {once: knotId, repeat: true})
```

`narrator.stop()` cancels every owned lane without forgetting completed announcements. Setting `enabled = false` also cancels every lane and skips new requests until re-enabled. `dispose()` / `[Symbol.dispose]()` additionally releases the controller permanently. Disposing a queue never closes an application-owned AudioContext.

A lazy input `(signal) => reference | Promise<reference>` can wait for a label, fetch data or select a recording only when its queue slot becomes active. Providers should respect the signal. Late-created playback resources are still disposed when a provider ignores cancellation.

## Speech providers and browser fallback

Configure a synthesizer that returns an audio URL or Blob to get ordinary pausable, independently playable audio:

```ts
import {Narrator, SpeechCache} from 'use-narrator/core'

const cache = new SpeechCache(async (speech, signal) => {
  const response = await fetch('/api/speech', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({text: speech.text, voice: speech.voice}),
    signal,
  })
  if (!response.ok) throw new Error(`Speech request failed (${response.status})`)
  return response.blob()
})

const narrator = new Narrator({synthesize: cache.synthesize})
narrator.push('A generated voice')
narrator.push({text: 'Use native speech for this one', synthesize: 'browser'})
```

An individual speech reference can override `synthesize`, `voice`, `lang`, `rate` and `pitch`. Custom synthesizers receive these fields and decide how to apply them. Use a separate cache per provider/configuration; the cache key includes text/language/rate/pitch/voice. Completed results use bounded LRU storage (24 entries by default). Concurrent consumers share a generation request, but cancelling one does not cancel another. The last departing consumer aborts generation. Dispose the cache along with its owning provider.

Without a synthesizer, text uses native browser speech. Native speech has a global, non-mixing queue, not independently seekable audio tracks. Consequently:

- Injection releases the native lane and later restarts at the last reported word boundary. A word may repeat; without boundary events it restarts the utterance.
- Concurrent native utterances are rejected explicitly rather than secretly queued or allowed to cancel each other. Synthesized audio is required for truly simultaneous TTS.
- The package cancels only its owned active native utterance, not a detected unrelated speaker. Other code should not directly operate the native speech queue while this narrator owns it.

See the [Web Speech specification](https://webaudio.github.io/web-speech-api/) for the native queue and boundary event contracts. Recorded and provider-generated audio resume on the same HTMLAudioElement at its preserved playback position. Where `audio.context()` returns an audio context, recordings play decoded through it instead (`audioBuffer` of `use-audio-queue/browser`), and `audio.connect(output, instanceId)` receives the node they leave rather than a media element; contexts that can’t take media elements, like an offline one rendering a film, need it.

## Timing and subtitles

A narration can know when each word of its `text` is spoken. Recordings take a `timing`, and a synthesizer can return `{audio, timing}` instead of bare audio. Either way the narration state carries it while that audio plays; a fallback to native speech drops it, since it belongs to the audio it was measured on.

```ts
narrator.push({audio: '/goose.opus', text, timing: timingFromCharacters(text, spans)})
const cache = new SpeechCache(async (speech, signal) => {
  const audio = await generate(speech.text, signal)
  return {audio, timing: timingFromWords(speech.text, await transcribe(audio, signal))}
})
```

A `NarrationTiming` holds every whitespace-separated word of the text (`narrationWords(text)`) as `{from, to, start, end}`, character range and seconds, plus optional per-character spans for letter-exact highlighting:

- `timingFromWords(text, recognized)` maps speech-to-text words with timestamps onto the text through a character-level edit alignment, so misheard, split, merged or missing words only cost their own letters. It gives no character spans, since letters interpolated within a recognized word would only pretend to be exact.
- `timingFromCharacters(text, spans)` takes one span (or `null`) per character, as forced aligners report them.
- `estimateTiming(text, duration)` spreads the duration over the letters with pauses at punctuation, for audio without a timing. Good enough to pace sentences, not to follow words.

`narrator.progress(instanceId)` reads where a narration’s playback stands (`{seconds, duration}`, or `{character}` for native speech, which only reports the word it reached), and `narrationCursor(words, progress, timing)` turns that into the current word and how far into it speech is. Both are cheap enough for every animation frame.

## Slop Gallery integration

`src/lib/audio/narration.ts` owns the one application narrator, its 0.15-second gap, 0.12-second leading silence and 0.5-second trailing silence. It wires mute, stop, teleport, page-hide, the real audio meter and a read-only gallery-state projection for existing telemetry.

`PortraitNarration.ts` handles portrait readiness and provider configuration. `KnotNarration.ts` selects bundled model/candidate/knot recordings. Neither owns audio elements, speech synthesis, timers or indicator state. Components can enqueue directly on the shared narrator. Player sound effects remain separate by design.

## Validation

From this package: `bun run test`. From the repository root:

```sh
bun test ./packages/use-narrator/test ./packages/use-narrator/packages/use-audio-queue/test
bun test ./test/unit/narrator.test.ts ./test/unit/knot-narration.test.ts
```
