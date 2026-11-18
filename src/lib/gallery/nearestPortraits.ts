import type {Portrait, Vec3} from './types.ts'

import {perceptualDistance} from '../perceptualDistance.ts'
import {portraitPosition} from './portraitObjects.ts'

/** The works sorted by their {@link perceptualDistance} from the point, where they are right now (see {@link portraitPosition}), the nearest first; works equally far keep their order. */
export default function nearestPortraits<T extends Pick<Portrait, 'id' | 'position'>>(portraits: ReadonlyArray<T>, from: Vec3): Array<T> {
  const distances = new Map(portraits.map(portrait => [portrait, perceptualDistance(from, portraitPosition(portrait))]))
  return portraits.toSorted((a, b) => distances.get(a)! - distances.get(b)!)
}
