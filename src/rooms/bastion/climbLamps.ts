import type Passage from '#src/lib/gallery/passages/Passage.ts'
import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Lamp} from '../base/Room.ts'

import {bastionOrigin} from '#src/lib/gallery/bastion.ts'
import {climbApproach, climbApproachLantern, climbHairpin, climbLanterns, climbMouth, climbPassageLanterns, climbRun, climbRunLantern} from '#src/lib/gallery/climb.ts'
import {passageLight, passageLightCount, routeLight} from '#src/lib/gallery/pendants/mounts.ts'

const [originX, originY, originZ] = bastionOrigin
/** `below` meters under the middle of the lantern whose light hangs at the position, with how it shines: like the Bastion’s lanterns */
export const lantern = ([x, y, z]: Vec3, shine: Pick<Lamp, 'decay' | 'range' | 'strength'> = {}, below = 0.3): Lamp => ({
  position: [x - originX, y - below - originY, z - originZ],
  strength: 30,
  tint: '#ffcd8a',
  range: 7,
  decay: 1.75,
  shadow: true,
  ...shine,
})
/** The lights of the lanterns a straight passage keeps, by their mount order across its spans. */
const keptLights = (passage: Passage, kept: ReadonlyArray<boolean>) => passage.spans.flatMap((_, span) => Array.from({length: passageLightCount(passage, span)}, (__, index) => passageLight(passage, span, index))).filter((_, mount) => kept[mount])
const [elbow] = keptLights(climbMouth, climbPassageLanterns.mouth)

export default {
  // Before the elbow at the end of the run west under the Forge.
  lantern_elbow: lantern(elbow),
  // At the apex of the turn and halfway up the east leg.
  lantern_turn: lantern(routeLight(climbHairpin, climbLanterns.turn)),
  lantern_climb: lantern(routeLight(climbHairpin, climbLanterns.east)),
  // Halfway along the run north, over the Lodge’s roof, and along the approach east, right before the arch of the Forge’s vestibule.
  lantern_run: lantern(routeLight(climbRun, climbRunLantern)),
  lantern_strip: lantern(routeLight(climbApproach, climbApproachLantern)),
} satisfies Record<string, Lamp>
