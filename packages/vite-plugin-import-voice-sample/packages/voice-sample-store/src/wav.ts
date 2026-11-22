/** the bytes of a canonical WAV’s header, which its PCM follows */
const headerSize = 44
/** the most PCM bytes the header’s RIFF size field can count */
const maximumPcmSize = 0xFF_FF_FF_FF - (headerSize - 8)

/** Wraps mono signed 16-bit little-endian PCM in the canonical 44-byte header of a WAV of `sampleRate`, the only WAV this package writes and reads. */
export const encodeCanonicalWav = (pcm: Uint8Array, sampleRate: number) => {
  if (!pcm.byteLength || pcm.byteLength % 2 || pcm.byteLength > maximumPcmSize) {
    throw new RangeError('A canonical WAV holds a nonempty, whole number of 16-bit samples.')
  }
  if (!Number.isSafeInteger(sampleRate) || sampleRate <= 0) {
    throw new RangeError('A canonical WAV needs a positive integer sample rate.')
  }
  const wav = new Uint8Array(headerSize + pcm.byteLength)
  const header = Buffer.from(wav.buffer)
  header.write('RIFF', 0)
  header.writeUInt32LE(headerSize - 8 + pcm.byteLength, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.byteLength, 40)
  wav.set(pcm, headerSize)
  return wav
}

/**
 * Reads a WAV as {@link encodeCanonicalWav} writes it: its PCM, as a view into `wav`, and its sample rate. Throws for any other WAV, and for one of another sample rate than `sampleRate` if given.
 */
export const decodeCanonicalWav = (wav: Uint8Array, sampleRate?: number) => {
  if (wav.byteLength < headerSize) {
    throw new Error('Stored WAV is truncated.')
  }
  const header = Buffer.from(wav.buffer, wav.byteOffset, headerSize)
  const pcmSize = wav.byteLength - headerSize
  const storedRate = header.readUInt32LE(24)
  if (
    header.toString('ascii', 0, 4) !== 'RIFF'
    || header.readUInt32LE(4) !== wav.byteLength - 8
    || header.toString('ascii', 8, 16) !== 'WAVEfmt '
    || header.readUInt32LE(16) !== 16
    || header.readUInt16LE(20) !== 1
    || header.readUInt16LE(22) !== 1
    || storedRate === 0
    || header.readUInt32LE(28) !== storedRate * 2
    || header.readUInt16LE(32) !== 2
    || header.readUInt16LE(34) !== 16
    || header.toString('ascii', 36, 40) !== 'data'
    || header.readUInt32LE(40) !== pcmSize
    || pcmSize === 0
    || pcmSize % 2
  ) {
    throw new Error('Stored WAV is not canonical mono signed 16-bit PCM.')
  }
  if (sampleRate !== undefined && storedRate !== sampleRate) {
    throw new Error(`Stored WAV has a sample rate of ${storedRate} Hz instead of ${sampleRate} Hz.`)
  }
  return {
    pcm: wav.subarray(headerSize),
    sampleRate: storedRate,
  }
}
