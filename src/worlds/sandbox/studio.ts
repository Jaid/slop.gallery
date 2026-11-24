import {environmentSeed} from '#src/lib/gameSeed.ts'
import {studioTuning} from '#src/lib/worldTuning/StudioTuningModule.ts'

import StudioSandbox from './StudioSandbox.ts'

/** the Sandbox with the Studio, created once, as the world tuning designs it: as this game’s seed rolls it, unless a reload for a tuned size or frame carried other values over */
const sandbox = new StudioSandbox(environmentSeed, studioTuning.get())

export default sandbox
