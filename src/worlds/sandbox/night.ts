import {sunDirectionFromAngles} from '#src/lib/gallery/sun.ts'
import nightSky from '#src/lib/materials/NightSky.ts'

import {moonDirection} from './moon.ts'

/** The Sandbox’s night sky, its moon where the moonlight comes from, a waxing gibbous lit by the sun deep under the north-northwestern horizon, and the Milky Way arching through the zenith from the south-southeast, where its core stands, to the north-northwest, across the roof lights of both slopes and 30° clear of the moon. */
const sky = nightSky({
  moonDirection,
  sunDirection: sunDirectionFromAngles(330, -30),
  galacticPole: sunDirectionFromAngles(60, 0),
  galacticCenter: sunDirectionFromAngles(150, 35),
})
export default sky
