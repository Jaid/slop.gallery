import type {Material} from 'three/webgpu'

import {MeshStandardNodeMaterial} from 'three/webgpu'

import {floorGlassThickness} from '../gallery/floors.ts'
import {salonWindow} from '../gallery/lobbyWindows.ts'
import {lodgeWindow} from '../gallery/lodge.ts'
import CastFloorGlassMaterial from './CastFloorGlassMaterial.ts'
import ClearGlassMaterial from './ClearGlassMaterial.ts'
import CrownGlassMaterial from './CrownGlassMaterial.ts'
import {lightIndoors} from './lights/index.ts'

export type ArchitecturalGlassMaterials = {
  cabin: Material
  lobby: Material
  /** the glass walls between the Lobby and the Salon and the Forge, cast like the Lobby’s floor window */
  lobbyWindow: Material
  tunnel: Material
}

/** Edge length of the cast pavers in the lobby’s 8 m floor window and in the glass wall beside it. */
const floorGlassTileSize = salonWindow.tileSize
const heavyMaterials = {
  // Old drawn cabin glass: a faint green body, ripples that bend the view and the reflections, a pale veil, wiped smudges and grime along the frame, plus a warm clearcoat sheen that catches the lodge’s firelight.
  // It sits between two underground spaces, so it only reflects their lamps and their darkness.
  cabin: () => lightIndoors(new CrownGlassMaterial({
    name: 'cabin-glass-heavy',
    ior: 1.52,
    absorption: 0.06,
    specularColor: '#ffeacc',
    clearcoat: 0.5,
    envMapIntensity: 1.6,
    paneSize: [lodgeWindow.width, lodgeWindow.top - lodgeWindow.bottom],
    bodyColor: '#eef4ea',
    haze: 0.035,
    smudges: 0.065,
    grime: 0.5,
    waviness: 0.005,
  })),
  // Cast pavers that bend the Oculus below into a rippling, dispersive view.
  lobby: () => new CastFloorGlassMaterial({
    thickness: floorGlassThickness,
    tileSize: floorGlassTileSize,
  }),
  lobbyWindow: () => createLobbyWindowGlass(),
  // Low-iron museum display glass whose anti-reflective coating leaves a faint violet and green sheen at grazing angles.
  tunnel: () => new ClearGlassMaterial({
    name: 'tunnel-glass-heavy',
    ior: 1.5,
    absorption: 0.015,
    iridescence: 0.7,
    iridescenceIOR: 1.38,
    iridescenceThicknessMinimum: 220,
    iridescenceThicknessMaximum: 420,
    envMapIntensity: 1.3,
  }),
}

/** Create just one kind of glazing. Room-scoped scenes must not allocate the other rooms’ glass as a side effect. */
export function createArchitecturalGlassMaterial(kind: keyof ArchitecturalGlassMaterials, heavy: boolean): Material {
  if (heavy) {
    return heavyMaterials[kind]()
  }
  const tunnel = kind === 'tunnel'
  const material = new MeshStandardNodeMaterial({
    color: tunnel ? '#b7d8d9' : '#afd0d4',
    roughness: tunnel ? 0.16 : 0.24,
    metalness: tunnel ? 0.1 : 0,
    transparent: true,
    opacity: tunnel ? 0.16 : 0.24,
    depthWrite: false,
    envMapIntensity: tunnel ? 1 : 0,
  })
  material.name = tunnel ? 'tunnel-glass-fast' : 'architectural-glass-fast'
  return material
}

export function createArchitecturalGlassMaterials(isHeavy: boolean): ArchitecturalGlassMaterials {
  const lobby = createArchitecturalGlassMaterial('lobby', isHeavy)
  return {
    lobby,
    cabin: isHeavy ? createArchitecturalGlassMaterial('cabin', true) : lobby,
    lobbyWindow: isHeavy ? createArchitecturalGlassMaterial('lobbyWindow', true) : lobby,
    tunnel: createArchitecturalGlassMaterial('tunnel', isHeavy),
  }
}

export function disposeArchitecturalGlassMaterials(materials: ArchitecturalGlassMaterials) {
  for (const material of new Set(Object.values(materials))) {
    material.dispose()
  }
}

/**
 * The Lobby’s cast pavers, set upright between the Lobby and the Salon and the Forge.
 *
 * Its own instance because it leaves the depth buffer alone: the pane refracts only opaque surfaces, so seen from the Salon or the Forge it
 * would replace the floor window behind it with the Oculus below. Drawn before every other transparent surface and without depth,
 * the floor window still draws over it.
 */
function createLobbyWindowGlass() {
  const material = new CastFloorGlassMaterial({
    thickness: salonWindow.thickness,
    tileSize: salonWindow.tileSize,
  })
  material.name = 'lobby-window-glass-heavy'
  material.depthWrite = false
  return material
}
