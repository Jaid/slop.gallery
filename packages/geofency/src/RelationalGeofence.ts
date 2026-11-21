import type {Box, BoxInput} from './box/index.ts'
import type {Position} from './types.ts'

import Geofence from './Geofence.ts'

/**
 * A geofence that also takes in the space of other fences, named by their ids in the {@link GeofenceCollection} it is in, like a room made of its parts.
 * On its own, it is the fence of its own boxes, which may be none: {@link contains}, {@link overlaps} and {@link subtract} only go by them. Its collection matches it wherever one of its own boxes or any fence it relates to holds the position, and {@link GeofenceCollection.resolve} turns it into a geofence of all the boxes it takes in.
 */
export default class RelationalGeofence<Relation extends string = string> extends Geofence {
  // Its relations may fence it all, which it checks once it knows them.
  protected static override readonly minimumBoxes = 0
  /** the ids of the fences of its collection whose space it takes in, in the order given, each once */
  readonly relations: ReadonlySet<Relation>

  /** Takes boxes or their plain data, see {@link createBox}, and the ids of the fences it relates to, in any mix, but at least one of either. */
  constructor(definitions: ReadonlyArray<Box | BoxInput | Relation>) {
    super(definitions.filter((definition): definition is Box | BoxInput => typeof definition !== 'string'))
    this.relations = new Set(definitions.filter((definition): definition is Relation => typeof definition === 'string'))
    if (!this.boxes.length && !this.relations.size) {
      throw new RangeError('A relational geofence needs at least one box or relation.')
    }
  }

  /** A new relational geofence with every box moved by the offset and the same relations, whose fences move by themselves. */
  override translate(offset: Position) {
    return new RelationalGeofence<Relation>([...this.boxes.map(box => box.translate(offset)), ...this.relations])
  }
}
