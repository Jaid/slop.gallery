import hsl from 'okhsl'

/** the colors of the Frost Orb’s winter, shared by its glass, its mood and the blizzard out of its fusion’s portal, as packed sRGB */
export const frostColors = {
  /** fresh snow and the faces of ice crystals catching the light */
  snow: hsl.integer(240, 45, 98),
  /** glacial ice where it is thick, a clear, deep cyan */
  ice: hsl.integer(228, 90, 70),
  /** the cold glow that ice and snow give back of the light, which the orb’s crystal shines with */
  glow: hsl.integer(236, 100, 85),
  /** the deep blue of a winter night’s shadows */
  night: hsl.integer(266, 85, 10),
  /** the blue between the night and the ice, where the storm is thick */
  dusk: hsl.integer(258, 75, 36),
  /** the glints flashing off the crystals’ faces now and then, white with a hint of the aurora */
  glint: hsl.integer(200, 60, 98),
  /** the aurora shimmering high in the storm, green fading into violet */
  aurora: hsl.integer(155, 95, 80),
  auroraFringe: hsl.integer(300, 75, 62),
} as const
