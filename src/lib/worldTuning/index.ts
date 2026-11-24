import {lightingTuning} from './LightingTuningModule.ts'
import {overlayTuning} from './OverlayTuningModule.ts'
import {pipelineTuning} from './PipelineTuningModule.ts'
import {viewTuning} from './ViewTuningModule.ts'
import WorldTuning from './WorldTuning.ts'

/** The world tuning of this page: every module its world has, in the order the panel shows them. A new module joins here. */
const worldTuning = new WorldTuning([viewTuning, lightingTuning, pipelineTuning, overlayTuning])

export default worldTuning
export type {TuningSource} from './base/TuningModule.ts'
export type {TuningValue, TuningValues} from './controls.ts'
export type {TuningChange, TuningChanges, TuningControlDump, TuningModuleDump} from './WorldTuning.ts'
