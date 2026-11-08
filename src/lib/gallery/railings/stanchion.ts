/** how tall a stanchion stands, from the floor to the top of its finial */
export const stanchionHeight = 1

/** the ball on top of a stanchion */
export const finial = {
  radius: 0.075,
  y: stanchionHeight - 0.075,
}

/** the top of the beaded collar under the finial */
export const collarTop = finial.y - 0.04

/** the height the ropes hang from, at the collar under each stanchion’s finial */
export const ropeTop = finial.y - 0.025
