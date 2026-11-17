import HalloweenOrb from './halloween/HalloweenOrb.ts'
import HorrorOrb from './horror/HorrorOrb.ts'
import ImpastoOrb from './impasto/ImpastoOrb.ts'
import PaintOrb from './paint/PaintOrb.ts'
import SpookOrb from './spook/SpookOrb.ts'
import {transparentOrb} from './transparent/TransparentOrb.ts'

/** the radius of every orb’s ball, in meters */
export const orbRadius = 0.14

export const halloweenOrb = new HalloweenOrb
export const horrorOrb = new HorrorOrb
export const impastoOrb = new ImpastoOrb
export const paintOrb = new PaintOrb
export const spookOrb = new SpookOrb
export const orbs = [halloweenOrb, horrorOrb, impastoOrb, paintOrb, spookOrb, transparentOrb] as const
/** the orbs that rework a work by a prompt of their own */
export const promptOrbs = [halloweenOrb, horrorOrb, impastoOrb, paintOrb, spookOrb] as const
/** the orbs that turn up at random where nothing asks for a kind of its own, on the Vesper’s pedestals; never the Horror Orb or the Paint Orb, which only the hatchet and the Painting Set call up, steering the Forge’s alchemy machine to them; in the default environment, the pedestals stand them in this order */
export const randomOrbs = [transparentOrb, spookOrb, halloweenOrb, impastoOrb] as const

export type {default as Orb} from './base/Orb.ts'
export {transparentOrb} from './transparent/TransparentOrb.ts'
