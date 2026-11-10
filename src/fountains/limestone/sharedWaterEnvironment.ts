import WaterEnvironment from './WaterEnvironment.ts'

/**
 * The reflection environment shared by every piece of the limestone fountain’s water.
 *
 * A bright procedural sky instead of the gallery’s dim gradient is what lets the ripples and the falling sheets sparkle: their normals swing across the sun’s disc and the bright crown of the vault. It belongs to the page, like the shared gold and steel environments, so graphics-mode changes and remounts do not build it again.
 */
const sharedWaterEnvironment = new WaterEnvironment

export default sharedWaterEnvironment
