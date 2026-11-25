/** the mean of a packed sRGB color’s channels, from 0 to 255 */
export default function lightness(value: number) {
  return ((value >> 16 & 255) + (value >> 8 & 255) + (value & 255)) / 3
}
