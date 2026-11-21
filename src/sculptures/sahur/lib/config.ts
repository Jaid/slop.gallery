/** Shared anatomical landmarks for Tung Tung Tung Sahur (meters, y = 0 at socket top, +Z front). */
export const sahurPose = {
  /** center of the log torso in X and Z (shifted slightly +X so the bat on −X balances visually on the socket) */
  cx: 0.18,
  cz: -0.06,
  /** flat beveled underside of the log torso */
  bodyBottomY: 1.42,
  /** flat-topped beveled crown of the log */
  bodyTopY: 3.8,
  /** hefty straight-sided horizontal radii of the wooden log cylinder */
  bodyRx: 0.375,
  bodyRz: 0.345,
  /** oversized eye socket centers relative to body center */
  eyeOffsetX: 0.178,
  eyeY: 3.21,
  eyeRadius: 0.146,
  /** eye globe center Z relative to cz */
  eyeCenterZ: 0.258,
  /** shoulder attachment height */
  shoulderY: 2.34,
  /** leg attachment X offset from cx */
  hipOffsetX: 0.165,
  /** chunky baseball bat handle butt (peeking past fist near lower-left torso corner) and barrel tip center (tangent to y = 0) */
  batKnob: [-0.215, 1.67, -0.06] as const,
  batTip: [-1.19, 0.156, 0.22] as const,
  batTipRadius: 0.15,
} as const
