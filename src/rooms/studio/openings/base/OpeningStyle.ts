import type {Polygons} from '../lib/polygons.ts'
import type {Arrayable, FatedId} from 'fated-random'
import type FatedRandom from 'fated-random'

/** how far openings may reach from their middle along the ceiling’s x and y, the room’s x and z, in meters */
export type Spread = {
  x: number
  y: number
}
/** names a roll among the others of a pattern */
type RollKey = Arrayable<FatedId>

/** The rolls of one pattern, each named by its own key, so adding a roll never changes the others. */
export class Rolls {
  constructor(readonly random: FatedRandom) {}

  /** A number from `min` up to `max`. */
  between(key: RollKey, min: number, max: number) {
    return min + this.random.makeChild(key).roll() * (max - min)
  }

  chance(key: RollKey, chance: number) {
    return this.random.makeChild(key).rollBoolean({chance})
  }

  child(key: RollKey) {
    return new Rolls(this.random.makeChild(key))
  }

  /** An integer from `min` to `max`, both included. */
  integer(key: RollKey, min: number, max: number) {
    return this.random.makeChild(key).rollInteger(min, max)
  }

  /** One of the items, each as likely as the others unless `weights` say otherwise. */
  item<const Item>(key: RollKey, items: ReadonlyArray<Item>, weights?: ReadonlyArray<number>) {
    return this.random.makeChild(key).rollItem(items, weights && {weights})
  }
}

/**
 * A kind of openings cut through the Studio’s ceiling, which a seed rolls the shapes, sizes and divisions of: the holes of a pattern, which the light falls through in shafts onto the floor, where it draws the same pattern.
 * A pattern covers the whole of the room it has, to its edges.
 * The light blurs whatever is narrower than a few centimeters at 10 m, so bars and panes stay well over that.
 */
export default abstract class OpeningStyle {
  /** what it looks like, in a few words */
  abstract readonly description: string
  abstract readonly id: string
  /** the narrowest pane worth cutting, in meters */
  protected readonly smallest = 0.07
  /** how often seeds roll it compared with the others */
  readonly weight: number = 1

  /** How wide the bars between the panes are, rolled within the range every style shares unless it asks for another, and a little wider for openings reaching farther than 1.6 m, as tracery is in larger windows. */
  protected bar(rolls: Rolls, min = 0.045, max = 0.075, reach = 1.6) {
    return rolls.between('bar', min, max) * Math.min(1.4, Math.max(1, Math.sqrt(reach / 1.6)))
  }

  /** The holes of a pattern, centered on the origin, reaching out to `spread` from it and no farther. */
  abstract make(rolls: Rolls, spread: Spread): Polygons
}
