import {afterEach, beforeEach, expect, test} from 'bun:test'

import {flush} from '../packages/use-audio-queue/test/helpers.ts'
import {browserSpeech} from '../src/browser.ts'
import {Narrator} from '../src/core.ts'

class Utterance extends EventTarget {
  lang = ''
  pitch = 1
  rate = 1
  voice = null
  constructor(readonly text: string) {
    super()
  }
}
const original = {
  speechSynthesis: globalThis.speechSynthesis,
  SpeechSynthesisUtterance: globalThis.SpeechSynthesisUtterance,
}
let narrator: Narrator
let utterances: Array<Utterance>
let synthesis: {
  cancel: () => void
  cancellations: number
  getVoices: () => []
  paused: boolean
  pending: boolean
  speak: (utterance: Utterance) => void
  speaking: boolean
}
beforeEach(() => {
  utterances = []
  synthesis = {
    speaking: false,
    pending: false,
    paused: false,
    cancellations: 0,
    getVoices: () => [],
    cancel() {
      this.cancellations++
      this.speaking = false
    },
    speak(utterance) {
      this.speaking = true
      utterances.push(utterance)
      utterance.dispatchEvent(new Event('start'))
    },
  }
  Object.assign(globalThis, {
    speechSynthesis: synthesis,
    SpeechSynthesisUtterance: Utterance,
  })
  narrator = new Narrator
})
afterEach(() => {
  narrator.dispose()
  Object.assign(globalThis, original)
})
const end = () => {
  synthesis.speaking = false
  utterances.at(-1)!.dispatchEvent(new Event('end'))
}
test('native speech obeys the same serialized queue and exposes browser metadata', async () => {
  narrator.push({
    text: 'First',
    rate: 0.91,
    lang: 'en-GB',
  })
  narrator.push('Second')
  await flush()
  expect(utterances.map(u => u.text)).toEqual(['First'])
  expect(utterances[0].rate).toBe(0.91)
  expect(narrator.getSnapshot().current?.metadata.source).toBe('browser')
  end()
  await flush()
  expect(utterances.map(u => u.text)).toEqual(['First', 'Second'])
})
test('injected native speech resumes at the last reported boundary and ignores stale callbacks', async () => {
  const interrupted = narrator.push('Alpha beta gamma')
  await flush()
  const [interruptedUtterance] = utterances
  interruptedUtterance.dispatchEvent(Object.assign(new Event('boundary'), {charIndex: 6}))
  const inserted = narrator.push('Inserted', {priority: 'inject'})
  await flush()
  expect(synthesis.cancellations).toBe(1)
  expect(utterances.map(u => u.text)).toEqual(['Alpha beta gamma', 'Inserted'])
  interruptedUtterance.dispatchEvent(new Event('end'))
  expect(narrator.getSnapshot().current?.id).toBe(inserted.id)
  end()
  await flush()
  expect(narrator.getSnapshot().current?.id).toBe(interrupted.id)
  expect(utterances.at(-1)!.text).toBe('beta gamma')
  expect(synthesis.cancellations).toBe(1)
})
test('paused native speech releases the lane and restarts at the last reported boundary once resumed', async () => {
  const spoken = narrator.push('Alpha beta gamma')
  await flush()
  utterances[0].dispatchEvent(Object.assign(new Event('boundary'), {charIndex: 6}))
  narrator.pause()
  expect(synthesis.cancellations).toBe(1)
  // The cancelled utterance’s late end must not finish the paused narration.
  utterances[0].dispatchEvent(new Event('end'))
  await flush()
  expect(narrator.getSnapshot().current?.id).toBe(spoken.id)
  expect(utterances).toHaveLength(1)
  narrator.resume()
  await flush()
  expect(utterances.map(u => u.text)).toEqual(['Alpha beta gamma', 'beta gamma'])
  end()
  await flush()
  expect(await spoken.finished).toEqual({status: 'completed'})
  expect(synthesis.cancellations).toBe(1)
})
test('overlapping native speech fails explicitly without cancelling the active utterance', async () => {
  const first = narrator.push('First')
  await flush()
  const simultaneous = narrator.push('Concurrent', {priority: 'async'})
  await flush()
  const result = await simultaneous.finished
  expect(result.status).toBe('failed')
  if (result.status === 'failed') {
    expect(String(result.error)).toContain('cannot overlap')
  }
  expect(narrator.getSnapshot().current?.id).toBe(first.id)
  expect(synthesis.cancellations).toBe(0)
  expect(utterances).toHaveLength(1)
})
test('an unrelated native utterance is not cancelled when our attempt is rejected', async () => {
  synthesis.speaking = true
  const rejected = narrator.push('Cannot acquire native speech')
  const result = await rejected.finished
  expect(result.status).toBe('failed')
  expect(synthesis.cancellations).toBe(0)
  expect(synthesis.speaking).toBe(true)
})
test('stop cancels the owned native utterance once and never starts pending speech', async () => {
  const first = narrator.push('First')
  const second = narrator.push('Second')
  await flush()
  narrator.stop()
  await flush()
  const firstResult = await first.finished
  expect(firstResult.status).toBe('cancelled')
  const secondResult = await second.finished
  expect(secondResult.status).toBe('cancelled')
  expect(synthesis.cancellations).toBe(1)
  expect(utterances).toHaveLength(1)
})
test('native failure settles and allows the next queued utterance to start', async () => {
  const broken = narrator.push('Broken')
  const next = narrator.push('Next')
  await flush()
  synthesis.speaking = false
  utterances[0].dispatchEvent(Object.assign(new Event('error'), {error: 'synthesis-failed'}))
  await flush()
  const brokenResult = await broken.finished
  expect(brokenResult.status).toBe('failed')
  expect(narrator.getSnapshot().current?.id).toBe(next.id)
})
test('missing browser speech reports a capability error rather than hanging', () => {
  Object.assign(globalThis, {speechSynthesis: undefined})
  expect(() => {
    const speechController = new AbortController
    browserSpeech({text: 'Hello'}, speechController.signal)
  }).toThrow('unavailable')
})
