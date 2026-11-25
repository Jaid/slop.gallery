import hsl from 'okhsl'

import LanternBody from './LanternBody.ts'

/** the cabin lantern the passages hang from their ceilings */
export const passageLantern = new LanternBody
/** how its glass glows */
export const passageLanternGlow = {
  color: hsl.integer(82, 100, 89),
  emissive: hsl.integer(73, 100, 79.7),
  emissiveIntensity: 3,
}
