import type {PedestalLobe} from '#src/lib/gallery/DisplayPedestalGeometry.ts'

import {knotSign} from 'knot-materials/signs.ts'

import {tunnelSlopeHeight as tunnelFloorHeight, tunnelFrame, tunnelSlope} from '#src/lib/gallery/exhibitionTunnel.ts'
import tunnelDisplays, {placeInWorld, tunnelDisplayWindow} from '#src/lib/gallery/tunnelDisplays.ts'

/** how high the exhibits are shown over their displays’ floors: halfway up the windows, at eye level */
export const exhibitHeight = (tunnelDisplayWindow.bottom + tunnelDisplayWindow.top) / 2
/** how far out from a display’s back wall its exhibits are shown, over the middle of the pedestals backing onto it */
export const exhibitOffset = 1.3

/** the pedestals backing onto the displays’ back walls under the exhibits, their flanks running straight out of the wall before they round off toward the window; the height is over the floor where they meet the wall, under their exhibits */
export const exhibitionPedestal = {
  radius: 1.5,
  length: 0.9,
  height: 0.6,
  plinth: 0.1,
} as const

/** how far north of its exhibit the sidecar is centered on the wall, sunk deep into the pedestal’s flank */
const sidecarShift = 1.85
/** how far up the pedestal’s north flank, from the course there to the pedestal’s top, the sidecar’s top meets it */
export const exhibitionSidecarRise = 2 / 3
/** the course’s top under the pedestal’s north flank, over the floor where the pedestal meets the wall under its exhibit */
const flankCourse = exhibitionPedestal.plinth - tunnelSlope * exhibitionPedestal.radius

/** the lower sidecar merged into each pedestal’s north flank, running out toward the window like the pedestal before it rounds off, which carries the exhibit’s nameplate */
export const exhibitionSidecar = {
  radius: 0.8,
  length: 0.35,
  /** its top over the floor under its middle, which lies lower than the pedestal’s by the slope */
  height: flankCourse + exhibitionSidecarRise * (exhibitionPedestal.height - flankCourse) + tunnelSlope * sidecarShift,
  shift: sidecarShift,
  /** how far out from the back wall the nameplate stands on it */
  signOffset: 0.65,
  /** how far north of its middle the nameplate stands, so the turned plaque clears the pedestal’s cap */
  signShift: 0.1,
  /** how far a turned nameplate turns from facing the window, up the tunnel toward Moonfall to the south or down it toward the Oculus to the north */
  signTurn: Math.PI / 6,
} as const

/** which way each display’s nameplates turn, from its north end south: the lowest down the tunnel toward the Oculus, the middle one not at all and the highest up the tunnel toward Moonfall */
const signTurns = [-1, 0, 1] as const

/** the pedestal’s lobes, north to south, around where it meets the back wall under its exhibit */
export const exhibitionPedestalLobes = [
  {
    z: -exhibitionSidecar.shift,
    radius: exhibitionSidecar.radius,
    length: exhibitionSidecar.length,
    height: exhibitionSidecar.height,
  },
  {
    z: 0,
    radius: exhibitionPedestal.radius,
    length: exhibitionPedestal.length,
    height: exhibitionPedestal.height,
  },
] as const satisfies ReadonlyArray<PedestalLobe>

const exhibitionNumberLabel = (number: number) => `#${String(number).padStart(2, '0')}`

/**
 * where the Exhibition shows an exhibit in the museum’s meters, three in each display from its north end south, each turned a sixth of a revolution on from the one before, with its pedestal and nameplate
 *
 * The displays run along the tunnel’s diagonal, so everything is laid out in its frame (see `tunnelFrame`), where the back walls run along z, and placed from there, turned with the frame.
 */
export const exhibitionSlots = tunnelDisplays.flatMap(display => {
  /** from the back wall out toward the window */
  const direction = -display.direction as -1 | 1
  return display.exhibits.map((exhibit, index) => {
    const z = exhibit.position[2]
    const signZ = z - exhibitionSidecar.shift - exhibitionSidecar.signShift
    const signTurn = signTurns[index] * exhibitionSidecar.signTurn
    return {
      id: exhibit.id,
      direction,
      /** where the pedestal meets the back wall, on the floor */
      pedestal: placeInWorld([display.backX, tunnelFloorHeight(z), z]),
      /** the turn around y of the pedestal, whose back runs along its own z, with the diagonal */
      yaw: tunnelFrame.yaw,
      position: placeInWorld([display.backX + direction * exhibitOffset, tunnelFloorHeight(z) + exhibitHeight, z]),
      /** the nameplate’s plaque over the sidecar, facing the window and turned by its place along it */
      sign: {
        position: placeInWorld([display.backX + direction * exhibitionSidecar.signOffset, tunnelFloorHeight(z - exhibitionSidecar.shift) + exhibitionSidecar.height + knotSign.elevation, signZ]),
        // Facing the diagonal’s +z at no turn of its own, it turns from the window by its turn back toward +z, up the diagonal toward Moonfall, or on toward −z, down it toward the Oculus.
        rotation: tunnelFrame.yaw + direction * (Math.PI / 2 - signTurn),
      },
    }
  })
}).map((slot, index) => ({
  ...slot,
  label: exhibitionNumberLabel(index + 1),
  rotation: index * Math.PI / 3,
}))

