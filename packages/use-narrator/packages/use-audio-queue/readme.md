# use-audio-queue

Headless audio scheduling with an optional React subscription. No sound engine, provider, application store or DOM is required by the scheduler. Browser media playback is a separate adapter.

```ts
import {AudioQueue} from 'use-audio-queue/core'
import {audioFile} from 'use-audio-queue/browser'

const queue = new AudioQueue<{title: string}>({
  gap: 0.15,
  prependedSilence: 0.12,
  appendedSilence: 0.25,
})

const handle = queue.push(audioFile('/voice.opus'), {
  metadata: {title: 'Welcome'},
  priority: 'normal',
})
const result = await handle.finished
queue.dispose()
```

## Scheduling contract

`normal` appends FIFO. `high` inserts FIFO ahead of pending normal work without interrupting the current entry. `inject` suspends the current entry, including remaining silence, and resumes it after the injection; nested injections unwind LIFO before queued work. `async` runs independently in an explicit concurrent lane. `volatile` appends like normal work, but once it becomes current it is cancelled permanently by the next accepted request instead of resuming later. `shy` is skipped when any work exists; otherwise it is cancelled permanently by the next accepted request. `destructive` cancels current, queued, suspended and concurrent work, then schedules the replacement.

All timing values are seconds. `gap`, `prependedSilence` and `appendedSilence` are mutable, validated finite non-negative properties. Padding can be overridden per entry and is captured on push. The current gap value is used when scheduling a transition; changes do not rewrite an already-running timer.

The gap is the minimum interval between serialized sounds stopping and starting. Leading/trailing silence already contributes to it; it is not double-counted. Concurrent entries have independent padding and ignore the serialized gap. Immediate priorities still honor the configured timing. Resuming a paused sound does not prepend silence again.

## Custom playback

A task is created lazily when its slot becomes active:

```ts
queue.push(async ({signal, update}) => {
  const playback = await preparePlayback(signal)
  update({title: 'Prepared'})
  return playback
}, {metadata: {title: 'Preparing'}})
```

An `AudioPlayback` must implement:

```ts
type AudioPlayback = {
  play: () => void | Promise<void> // resolves when playback starts
  pause: () => void               // immediately pauses, preserving position
  dispose: () => void             // idempotent resource release
  finished: Promise<void>         // resolves at natural end, rejects on failure
  progress?: () => AudioProgress | undefined // optional: {seconds, duration?} on a media timeline, {character} for native speech
}
```

`queue.progress(id)` reads an entry’s `progress()` for visuals that follow playback, like subtitles or karaoke highlighting. It is not part of the snapshot, so polling it every animation frame never notifies subscribers. `audioFile()` reports the element’s `currentTime` and, once known, its duration.

`pause()` must stop output synchronously. `play()` may be called again after a pause. Neither pause nor play-start completion means the sound has finished. The adapter must prevent a late play resolution from restarting disposed or paused output. Factories should observe the provided AbortSignal; a factory that returns a resource after cancellation still has that resource disposed by the queue.

The scheduler owns each returned playback, but never closes shared application resources. Errors during preparation/start/playback release the slot and advance the queue. Stale start promises from before an injection cannot overwrite the resumed entry. A custom clock can be supplied for deterministic timer tests: `{now: () => seconds, schedule: (callback, seconds) => cancel}`.

## Handles and lifetime

`push()` returns `{id, finished, cancel}`. `finished` always resolves to `completed`, `cancelled`, `skipped` or `failed`, with a reason/error where applicable. Completion includes trailing silence. Unobserved fire-and-forget handles therefore do not create rejected promises.

`key` shares an existing unfinished handle; the existing entry's options and ownership win. Pass an owner `signal` to cancel a component's work independently. `cancel(id)`, `clear()` and `dispose()` cancel owned jobs, including timers and suspended resources; disposal is idempotent and supports `[Symbol.dispose]`. Pushing after disposal throws. `has(id)` reports whether a handle still belongs to live work.

`getSnapshot()` returns a stable, frozen snapshot until something changes: `current`, `pending`, `interrupted`, `concurrent`, `idle`. Entry phases are `queued`, `preparing`, `before`, `starting`, `playing`, `after`. Active timed `before`/`after` entries expose `phaseEndsAt`, the absolute deadline in the queue clock's monotonic seconds, so UI can synchronize an animation to removal even when padding was interrupted and resumed. Snapshot metadata is shallowly immutable. Subscribe with `subscribe(listener)` or React:

```tsx
import useAudioQueue from 'use-audio-queue'

function QueueStatus() {
  const state = useAudioQueue(queue)
  return <span>{state.current?.metadata.title ?? 'Idle'}</span>
}
```

The hook only subscribes. The application creates and disposes a shared queue, not every component that observes it. Use the `core` entry point outside React.

## Browser adapter

`audioFile()` accepts a URL string, URL object or Blob. Its options include `volume`, asynchronous `prepare(signal)` and `connect(audio) => disconnect` for an application-owned Web Audio graph. The adapter preserves the same HTMLAudioElement/currentTime across injections, removes handlers and media sources on teardown, and revokes only object URLs it created for Blobs. It does not revoke caller URLs, close shared AudioContexts or change the caller's mixer.

`audioBuffer(reference, {context})` plays the same references through an application-owned `BaseAudioContext` instead: it fetches and decodes the whole recording, plays it from an `AudioBufferSourceNode` through a gain at `volume` and reports its position on the context’s clock. Pausing stops the source and remembers where it stood; playing again starts a new one there. `connect(output) => disconnect` receives that gain node, which otherwise plays into the context’s destination. It suits contexts that can’t take media elements, like an `OfflineAudioContext` rendering a film, and sound that has to keep time with the rest of the context.

For text-to-speech, completion memory, provider caching and indicator metadata, use the parent `use-narrator` package.

## Tests

```sh
bun run test
```

Tests use a deterministic clock and fake transports for every priority, timer interruption, cancellation race and backend failure. Browser-adapter tests cover media events, cancellation while preparing, exact element/position reuse, URL ownership and cleanup, and decoded playback through a fake context, its pauses, resumption and failures.

## Global pause

Set `queue.paused = true` to hold every lane, including concurrent audio, without canceling requests or losing playback positions. Existing interrupted jobs stay interrupted. Preparation may finish and new requests may be queued while paused, but neither can start playback. Set it back to `false` to resume, preserving remaining padding and gaps; entry snapshots report `suspended` during the pause. Cancellation, clearing and disposal still work while paused.
