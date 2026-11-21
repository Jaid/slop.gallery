const c1 = 0xCC_9E_2D_51
const c2 = 0x1B_87_35_93
const rotateLeft = (value: number, bits: number) => value << bits | value >>> 32 - bits
const scramble = (block: number) => Math.imul(rotateLeft(Math.imul(block, c1), 15), c2)

/** Austin Appleby’s MurmurHash3 in its x86 32-bit variant, as an unsigned 32-bit integer. */
export default function murmur3(bytes: Uint8Array, seed = 0) {
  let hash = seed
  const tailStart = bytes.length - bytes.length % 4
  for (let index = 0; index < tailStart; index += 4) {
    const block = bytes[index] | bytes[index + 1] << 8 | bytes[index + 2] << 16 | bytes[index + 3] << 24
    hash = Math.imul(rotateLeft(hash ^ scramble(block), 13), 5) + 0xE6_54_6B_64 >>> 0
  }
  let tail = 0
  for (let index = bytes.length - 1; index >= tailStart; index--) {
    tail = tail << 8 | bytes[index]
  }
  if (tailStart < bytes.length) {
    hash ^= scramble(tail)
  }
  hash ^= bytes.length
  hash = Math.imul(hash ^ hash >>> 16, 0x85_EB_CA_6B)
  hash = Math.imul(hash ^ hash >>> 13, 0xC2_B2_AE_35)
  return (hash ^ hash >>> 16) >>> 0
}
