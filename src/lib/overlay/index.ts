import WorldOverlay from './WorldOverlay.ts'

/** The gallery’s shared world-space overlay. Each caller owns its returned drawings. */
const overlay = new WorldOverlay

export default overlay
export type {OverlayDrawing, OverlayStyle} from './WorldOverlay.ts'
