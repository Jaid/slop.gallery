/** Height of the default two-band baseboard above the floor. */
export const defaultBaseboardHeight = 0.25
/** How far the projecting cap of the default baseboard stands from the wall’s center line. */
export const defaultBaseboardFront = 0.25
/** Height of the projecting upper cap on the default baseboard. */
export const baseboardCapHeight = 0.04

export const wallTop = 5.8
export const wallFace = 0.105
/** how far in front of its wall’s center line the iron of a barred opening stands: halfway through its plaster, where the opening is just as wide as on the wall’s face */
export const barDepth = wallFace / 2
export const wallOpeningTrim = 0.17
/** how thick a passage’s stone barrel vault is, which springs from its walls’ center lines and so stands this far out behind them */
export const vaultShellThickness = 0.22
/** how far the casing round an opening stands out of its wall’s center line, by the wall’s trim style */
export const openingCasingFronts = {
  plain: 0.25,
  classic: 0.27,
} as const
/** the bands of a wall’s cornice, the lower one first: how tall each is, how far its front stands out of the wall’s center line and how far its middle lies under the wall’s top, 30 cm under the ceiling */
export const corniceBands = [
  {
    height: 0.1,
    front: 0.28,
    drop: 0.42,
  },
  {
    height: 0.23,
    front: 0.34,
    drop: 0.22,
  },
] as const
