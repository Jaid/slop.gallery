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
/** the orbs that turn up at random where nothing asks for a kind of its own, on the Vesper’s five pedestals; never the Horror Orb, which only the hatchet calls up, steering the Forge’s alchemy machine to it, nor the Transparent Orb, which only the alchemy machine’s holder keeps and a prompt orb’s fusion leaves; in the default environment, the pedestals stand them in this order */
export const randomOrbs = [spookOrb, halloweenOrb, impastoOrb, paintOrb, frostOrb] as const

export type {default as Orb} from './base/Orb.ts'
export {transparentOrb} from './transparent/TransparentOrb.ts'
