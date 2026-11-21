import murmur3 from './murmur3.ts'

// Different hash seeds for text and bytes, so text never stands in for its own UTF-8 bytes.
const textSeed = 0x73_6C_6F_70
const bytesSeed = 0x62_79_74_65
const textEncoder = new TextEncoder

/** A uint16 that only depends on the given text or bytes, every value as likely as the others. Text is hashed as UTF-8, a byte view only by the bytes it covers. */
export default function hashToUint16(data: Uint8Array | string) {
  const hash = typeof data === 'string' ? murmur3(textEncoder.encode(data), textSeed) : murmur3(data, bytesSeed)
  // Folding keeps every one of the 32 bits in the result.
  return (hash ^ hash >>> 16) & 0xFF_FF
}
