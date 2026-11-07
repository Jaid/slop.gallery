/** the oil paints the Paint Orb holds, each from a tube of its own, which its ribbons curl in and its effects are laid in */
export const oilPaints = {
  cadmiumYellow: '#f2b705',
  vermilion: '#d8341e',
  titaniumWhite: '#f4efe2',
  ultramarine: '#1f3aa8',
  viridian: '#0f7a5c',
} as const
export type OilPaint = keyof typeof oilPaints
