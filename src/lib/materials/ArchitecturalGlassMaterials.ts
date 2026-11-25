import type {Material} from 'three/webgpu'

import hsl from 'okhsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {floorGlassThickness} from '../gallery/floors.ts'
import {salonWindow} from '../gallery/lobbyWindows.ts'
import {lodgeWindow} from '../gallery/lodge.ts'
import MadeOnDemand from './base/MadeOnDemand.ts'
import CastFloorGlassMaterial from './CastFloorGlassMaterial.ts'
import ClearGlassMaterial from './ClearGlassMaterial.ts'
import CrownGlassMaterial from './CrownGlassMaterial.ts'
import {lightIndoors} from './lights/index.ts'

/** Edge length of the cast pavers in the lobby’s 8 m floor window and in the glass wall beside it. */
const floorGlassTileSize = salonWindow.tileSize
/** the one pane of fast graphics for every glass but the tunnel displays’ */
const createFastGlass = () => {
  const material = new MeshStandardNodeMaterial({
    color: hsl.integer(205, 28, 81),
    roughness: 0.24,
    metalness: 0,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    envMapIntensity: 0,
  })
  material.name = 'architectural-glass-fast'
  return material
}
// The tunnel displays keep their original fast-mode pane.
const createFastTunnelGlass = () => {
  const material = new MeshStandardNodeMaterial({
    color: hsl.integer(199, 30, 83.5),
    roughness: 0.16,
    metalness: 0.1,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  })
  material.name = 'tunnel-glass-fast'
  return material
}
// Old drawn cabin glass: a faint green body, ripples that bend the view and the reflections, a pale veil, wiped smudges and grime along the frame, plus a warm clearcoat sheen that catches the lodge’s firelight.
// It sits between two underground spaces, so it only reflects their lamps and their darkness.
const createCabinGlass = () => lightIndoors(new CrownGlassMaterial({
  name: 'cabin-glass-heavy',
  ior: 1.52,
  absorption: 0.06,
  specularColor: hsl.integer(77, 100, 93.8),
  clearcoat: 0.5,
  envMapIntensity: 1.6,
  paneSize: [lodgeWindow.width, lodgeWindow.top - lodgeWindow.bottom],
  bodyColor: hsl.integer(132, 34, 95),
  haze: 0.035,
  smudges: 0.065,
  grime: 0.5,
  waviness: 0.005,
}))
// Cast pavers that bend the Oculus below into a rippling, dispersive view.
const createFloorGlass = () => new CastFloorGlassMaterial({
  thickness: floorGlassThickness,
  tileSize: floorGlassTileSize,
})
/**
 * The Lobby’s cast pavers, set upright between the Lobby and the Salon and the Forge.
 *
 * Its own instance because it leaves the depth buffer alone: the pane refracts only opaque surfaces, so seen from the Salon or the Forge it
 * would replace the floor window behind it with the Oculus below. Drawn before every other transparent surface and without depth,
 * the floor window still draws over it.
 */
const createLobbyWindowGlass = () => {
  const material = new CastFloorGlassMaterial({
    thickness: salonWindow.thickness,
    tileSize: salonWindow.tileSize,
  })
  material.name = 'lobby-window-glass-heavy'
  material.depthWrite = false
  return material
}
// Low-iron museum display glass whose anti-reflective coating leaves a faint violet and green sheen at grazing angles.
const createTunnelGlass = () => new ClearGlassMaterial({
  name: 'tunnel-glass-heavy',
  ior: 1.5,
  absorption: 0.015,
  iridescence: 0.7,
  iridescenceIOR: 1.38,
  iridescenceThicknessMinimum: 220,
  iridescenceThicknessMaximum: 420,
  envMapIntensity: 1.3,
})

/**
 * The gallery’s architectural glass in heavy or fast graphics, each kind made the first time a wall or a room asks for it, so the panes of rooms out of the world’s reach are never made. Fast graphics share one plain pane among every kind but the tunnel displays’.
 */
export default class ArchitecturalGlassMaterials extends MadeOnDemand {
  constructor(private readonly heavy: boolean) {
    super()
  }

  /** the Lodge’s windows */
  get cabin(): Material {
    return this.heavy ? this.once('cabin', createCabinGlass) : this.lobby
  }

  /** the cast pavers of the floor windows, like the Lobby’s */
  get lobby(): Material {
    return this.once('lobby', this.heavy ? createFloorGlass : createFastGlass)
  }

  /** the glass walls between the Lobby and the Salon and the Forge, cast like the Lobby’s floor window */
  get lobbyWindow(): Material {
    return this.heavy ? this.once('lobbyWindow', createLobbyWindowGlass) : this.lobby
  }

  /** the panes of the tunnel’s displays, set in the openings of its walls */
  get tunnel(): Material {
    return this.once('tunnel', this.heavy ? createTunnelGlass : createFastTunnelGlass)
  }
}
