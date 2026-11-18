import type Passage from '#src/lib/gallery/passages/Passage.ts'
import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Lamp} from '../base/Room.ts'

import {bastionOrigin} from '#src/lib/gallery/bastion.ts'
import {climbHairpin, climbHairpinLantern, climbMouth, climbPassageLanterns, climbRun, climbRunLantern} from '#src/lib/gallery/climb.ts'
import {passageLight, passageLightCount, routeLight} from '#src/lib/gallery/pendants/mounts.ts'

const [originX, originY, originZ] = bastionOrigin
/** The light source sits 30 cm below the middle of the lantern. */
const lantern = ([x, y, z]: Vec3): Lamp => ({
  position: [x - originX, y - 0.3 - originY, z - originZ],
  strength: 30,
  tint: '#ffcd8a',
  range: 7,
  decay: 1.75,
  shadow: true,
})
/** The lights of the lanterns a straight passage keeps, by their mount order across its spans. */
const keptLights = (passage: Passage, kept: ReadonlyArray<boolean>) => passage.spans.flatMap((_, span) => Array.from({length: passageLightCount(passage, span)}, (__, index) => passageLight(passage, span, index))).filter((_, mount) => kept[mount])
const [elbow] = keptLights(climbMouth, climbPassageLanterns.mouth)

export default {
  // Before the elbow at the end of the run west under the Forge.
  lantern_elbow: lantern(elbow),
  // Halfway up the hairpin’s east leg.
  lantern_climb: lantern(routeLight(climbHairpin, climbHairpinLantern)),
  // Halfway along the run north, over the Lodge’s roof.
  lantern_run: lantern(routeLight(climbRun, climbRunLantern)),
} satisfies Record<string, Lamp>
