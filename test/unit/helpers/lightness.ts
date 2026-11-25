/** the mean of an sRGB hex color’s channels, from 0 to 255 */
export default function lightness(hex: number | string) {
  const value = typeof hex === 'number' ? hex : Number.parseInt(hex.slice(1), 16)
  return ((value >> 16 & 255) + (value >> 8 & 255) + (value & 255)) / 3
}
