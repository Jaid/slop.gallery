import forge, {forgeVestibule} from './forge.ts'

/** The workshop’s three south-facing sawteeth, in meters relative to the room. */
export const forgeRoof = {
  eaveY: 5.69,
  ridgeY: 7.95,
  endMargin: 0.68,
  /** Flat eaves keep the raised roof clear of the Lobby vault’s overhang. */
  ledge: 0.58,
  glassRun: 1.14,
  glassHalfWidth: 4.98,
  frameMargin: 0.14,
  paneColumns: 12,
  tieY: 5.28,
} as const

export type RoofPoint = readonly [y: number, z: number]

/** Interpolate along a roof pitch in its yz section. */
export const betweenRoofPoints = (a: RoofPoint, b: RoofPoint, t: number): RoofPoint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

const bayCount = 3
const halfDepth = forge.size[1] / 2
const bayDepth = (forge.size[1] - 2 * forgeRoof.endMargin) / bayCount
export const forgeRoofBays = Array.from({length: bayCount}, (_, i) => {
  const start = -halfDepth + forgeRoof.endMargin + i * bayDepth
  const ridge: RoofPoint = [forgeRoof.ridgeY, start + bayDepth - forgeRoof.glassRun]
  const sill: RoofPoint = [forgeRoof.eaveY, start + bayDepth]
  const inset = forgeRoof.frameMargin / Math.hypot(ridge[0] - sill[0], forgeRoof.glassRun)
  return {
    foot: [forgeRoof.eaveY, start],
    ridge,
    sill,
    glassTop: betweenRoofPoints(ridge, sill, inset),
    glassBottom: betweenRoofPoints(sill, ridge, inset),
  } as const
})

/** The vestibule’s segmental cap and the pendant hanging from it. */
export const forgeCupola = {
  springY: 5.62,
  crownY: 6.88,
  hubRadius: 0.42,
  ribs: 8,
  lampY: 5.26,
} as const

// The radius of the sphere whose cap meets the wall and reaches the crown.
const rise = forgeCupola.crownY - forgeCupola.springY
const sphere = (forgeVestibule.radius ** 2 + rise ** 2) / (2 * rise)
export const forgeCupolaHeight = (r: number) => forgeCupola.crownY - sphere + Math.sqrt(sphere ** 2 - r ** 2)
export const forgeCupolaNormal = (r: number) => [-r / sphere, -Math.sqrt(sphere ** 2 - r ** 2) / sphere] as const
