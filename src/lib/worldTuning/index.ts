import world from '#src/worlds/current.ts'

import {overlayTuning} from './OverlayTuningModule.ts'
import {pipelineTuning} from './PipelineTuningModule.ts'
import {viewTuning} from './ViewTuningModule.ts'
import WorldTuning from './WorldTuning.ts'

/** The world tuning of this page: the view, the modules only its world has, see `World.tuning`, the render pipeline and the overlay, in the order the panel shows them. A module every world has joins here. */
const worldTuning = new WorldTuning([viewTuning, ...world.tuning, pipelineTuning, overlayTuning])

export default worldTuning
export type {TuningSource} from './base/TuningModule.ts'
export type {ToldValue, TuningColor, TuningValue, TuningValues} from './controls.ts'
export type {ToldChanges, TuningChange, TuningChanges, TuningControlDump, TuningModuleDump} from './WorldTuning.ts'
