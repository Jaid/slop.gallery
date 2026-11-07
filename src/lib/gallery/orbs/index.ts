import HalloweenOrb from './halloween/HalloweenOrb.ts'
import HorrorOrb from './horror/HorrorOrb.ts'
import SpookOrb from './spook/SpookOrb.ts'
import {transparentOrb} from './transparent/TransparentOrb.ts'

/** the radius of every orb’s ball, in meters */
export const orbRadius = 0.14

export const halloweenOrb = new HalloweenOrb
export const horrorOrb = new HorrorOrb
export const spookOrb = new SpookOrb
export const orbs = [halloweenOrb, horrorOrb, spookOrb, transparentOrb] as const
/** the orbs that rework a work by a prompt of their own */
export const promptOrbs = [halloweenOrb, horrorOrb, spookOrb] as const
/** the orbs that turn up at random where nothing asks for a kind of its own, on the Vesper’s pedestals; never the Horror Orb, which only the hatchet calls up, steering the Forge’s alchemy machine to it */
export const randomOrbs = [transparentOrb, spookOrb, halloweenOrb] as const

export type {default as Orb} from './base/Orb.ts'
export {transparentOrb} from './transparent/TransparentOrb.ts'
