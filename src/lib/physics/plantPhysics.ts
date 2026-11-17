// Shared tuning for the current destructible specimens; no geometry is allocated here. Their masses are their colliders’ own.
export const leafPhysics = {
  gravityScale: 0.65,
  linearDamping: 1.2,
  angularDamping: 0.6,
  restitution: 0.1,
  friction: 0.9,
} as const

export const potPhysics = {
  restitution: 0.18,
  friction: 0.85,
} as const
