import type {MoodId} from '../index.ts'

import {steeredOrb} from '#src/lib/gallery/alchemy/flavor.ts'

/**
 * The id of the mood a prop casts while the player is in `room`: its own, like an orb’s wherever it is carried or viewed with V, or, in the Forge, that of the orb a magic item belongs to, as if that orb were held.
 * The pumpkin casts Halloween, the hatchet Horror, the helmet Spook and the Painting Set Paint. Picking one up in the Forge, or walking in while holding it, fades that mood in, and leaving or letting go fades it out. Anywhere else a magic item casts nothing.
 */
export function propMood(id: string, room: string, own?: MoodId): MoodId | undefined {
  return own ?? (room === 'forge' ? steeredOrb(id)?.mood : undefined)
}
