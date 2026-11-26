import FrostOrb from './frost/FrostOrb.ts'
import HalloweenOrb from './halloween/HalloweenOrb.ts'
import HorrorOrb from './horror/HorrorOrb.ts'
import ImpastoOrb from './impasto/ImpastoOrb.ts'
import PaintOrb from './paint/PaintOrb.ts'
import SpookOrb from './spook/SpookOrb.ts'
import {transparentOrb} from './transparent/TransparentOrb.ts'

/** the radius of every orb’s ball, in meters */
export const orbRadius = 0.14
/** the mass of every orb, in kg: a hollow ball of glass a little over 3 mm thick, which everything that strikes, pushes or is struck by an orb, like the Knottingham panes, goes by, and which throws are tuned around (`referenceMass` of `throwMotion.ts`) */
export const orbMass = 2

export const frostOrb = new FrostOrb
export const halloweenOrb = new HalloweenOrb
export const horrorOrb = new HorrorOrb
export const impastoOrb = new ImpastoOrb
export const paintOrb = new PaintOrb
export const spookOrb = new SpookOrb
/** the orbs that rework a work by a prompt of their own */
export const promptOrbs = [frostOrb, halloweenOrb, horrorOrb, impastoOrb, paintOrb, spookOrb] as const
export const orbs = [...promptOrbs, transparentOrb] as const
/** the orbs that turn up at random where nothing asks for a kind of its own, on the Vesper’s pedestals; never the Horror Orb or the Paint Orb, which only the hatchet and the Painting Set call up, steering the Forge’s alchemy machine to them; in the default environment, the pedestals stand them in this order */
export const randomOrbs = [transparentOrb, spookOrb, halloweenOrb, impastoOrb, frostOrb] as const

export type {default as Orb} from './base/Orb.ts'
export {transparentOrb} from './transparent/TransparentOrb.ts'
