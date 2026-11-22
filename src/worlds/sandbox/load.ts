import type Sandbox from './base/Sandbox.ts'

import {readRoom} from '#src/lib/gallery/spawn.ts'

/** The Sandbox a page with the URL opens, loading the modules of its room alone: the one with the Studio for `?room=studio`, otherwise the one with the Cell, which `?item` and `?turntable` furnish. */
export default async function loadSandbox(input?: URL | string): Promise<Sandbox> {
  if (readRoom(input) === 'studio') {
    const {default: studio} = await import('./studio.ts')
    return studio
  }
  const {default: cell} = await import('./cell.ts')
  return cell
}
