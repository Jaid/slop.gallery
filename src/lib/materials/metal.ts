import StudioEnvironment from 'knot-materials/StudioEnvironment.ts'

import BrushedMetalMaterial from './BrushedMetalMaterial.ts'

/** the softly lit studio the shared steel reflects, which other steel lying about the gallery borrows too, never disposing it */
export const studioEnvironment = new StudioEnvironment
/**
 * Shared satin steel for the Lobby bench frames (including their screws), the Oculus handrail/posts/end caps and Knottingham’s nameplate supports in heavy mode.
 *
 * The softly lit studio gives silver metal a readable light/dark reflection even in the dim Oculus, without inheriting the gallery environment’s olive cast. It is deliberately not a reflection of nearby artwork or people. No extra scene render is needed.
 *
 * Both the material and its environment live for the page lifetime, like the shared gold. Consumers borrow them; they must not dispose them on unmount.
 */
const metal = new BrushedMetalMaterial({environment: studioEnvironment})

export default metal
