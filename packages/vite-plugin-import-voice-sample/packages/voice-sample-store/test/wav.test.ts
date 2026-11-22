import {describe, expect, test} from 'bun:test'

import {decodeCanonicalWav, encodeCanonicalWav} from '../src/wav.ts'

const pcm = new Uint8Array([0x01, 0x00, 0xFF, 0x7F, 0x00, 0x80])
/** what every reader of a mono 16-bit PCM WAV at 24 kHz expects in front of these 3 samples */
const header = '52494646' + '2a000000' + '57415645' + '666d7420' + '10000000' + '0100' + '0100' + 'c05d0000' + '80bb0000' + '0200' + '1000' + '64617461' + '06000000'
const withField = (wav: Uint8Array, offset: number, write: (view: DataView) => void) => {
  const copy = Uint8Array.from(wav)
  write(new DataView(copy.buffer, offset))
  return copy
}
describe('canonical WAV', () => {
  test('wraps PCM in the 44-byte header of a mono 16-bit WAV and reads it back', () => {
    const wav = encodeCanonicalWav(pcm, 24_000)
    expect(wav).toBeInstanceOf(Uint8Array)
    expect(wav.byteLength).toBe(44 + pcm.byteLength)
    expect(wav.subarray(0, 44).toHex()).toBe(header)
    expect(wav.subarray(44)).toEqual(pcm)
    const decoded = decodeCanonicalWav(wav, 24_000)
    expect(decoded.sampleRate).toBe(24_000)
    expect(decoded.pcm).toEqual(pcm)
    expect(decodeCanonicalWav(wav).sampleRate).toBe(24_000)
  })
  test('reads PCM inside a larger buffer', () => {
    const wav = encodeCanonicalWav(pcm, 48_000)
    const padded = new Uint8Array(wav.byteLength + 3)
    padded.set(wav, 3)
    expect(decodeCanonicalWav(padded.subarray(3)).pcm).toEqual(pcm)
  })
  test('holds only a nonempty, whole number of samples at a positive sample rate', () => {
    expect(() => encodeCanonicalWav(new Uint8Array, 24_000)).toThrow('16-bit samples')
    expect(() => encodeCanonicalWav(new Uint8Array(3), 24_000)).toThrow('16-bit samples')
    expect(() => encodeCanonicalWav(pcm, 0)).toThrow('sample rate')
    expect(() => encodeCanonicalWav(pcm, 22_050.5)).toThrow('sample rate')
  })
  test('rejects a WAV that is truncated, laid out otherwise or of another sample rate', () => {
    const wav = encodeCanonicalWav(pcm, 24_000)
    expect(() => decodeCanonicalWav(wav.subarray(0, 43))).toThrow('truncated')
    const others = {
      riffSize: withField(wav, 4, view => view.setUint32(0, 0, true)),
      stereo: withField(wav, 22, view => view.setUint16(0, 2, true)),
      byteRate: withField(wav, 28, view => view.setUint32(0, 24_000, true)),
      blockAlign: withField(wav, 32, view => view.setUint16(0, 4, true)),
      bits: withField(wav, 34, view => view.setUint16(0, 8, true)),
      dataSize: withField(wav, 40, view => view.setUint32(0, 4, true)),
      trailing: Uint8Array.from([...wav, 0, 0]),
      empty: encodeCanonicalWav(pcm, 24_000).subarray(0, 44),
    }
    const accepted = Object.entries(others).filter(([, other]) => {
      try {
        decodeCanonicalWav(other)
        return true
      } catch (error) {
        return !(error as Error).message.includes('not canonical')
      }
    })
    expect(accepted.map(([name]) => name)).toEqual([])
    expect(() => decodeCanonicalWav(wav, 48_000)).toThrow('24000 Hz instead of 48000 Hz')
  })
})
