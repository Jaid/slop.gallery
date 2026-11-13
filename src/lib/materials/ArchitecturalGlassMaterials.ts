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
const createFastMaterials = (): ArchitecturalGlassMaterials => {
  const material = new MeshStandardNodeMaterial({
    color: '#afd0d4',
    roughness: 0.24,
    metalness: 0,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    envMapIntensity: 0,
  })
  material.name = 'architectural-glass-fast'
  // The tunnel displays keep their original fast-mode pane.
  const tunnel = new MeshStandardNodeMaterial({
    color: '#b7d8d9',
    roughness: 0.16,
    metalness: 0.1,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  })
  tunnel.name = 'tunnel-glass-fast'
  return {
    cabin: material,
    lobby: material,
    lobbyWindow: material,
    tunnel,
  }
}

export function createArchitecturalGlassMaterials(isHeavy: boolean): ArchitecturalGlassMaterials {
  if (!isHeavy) {
    return createFastMaterials()
  }
  return {
    // Old drawn cabin glass: a faint green body, ripples that bend the view and the reflections, a pale veil, wiped smudges and grime along the frame, plus a warm clearcoat sheen that catches the lodge’s firelight.
    // It sits between two underground spaces, so it only reflects their lamps and their darkness.
    cabin: lightIndoors(new CrownGlassMaterial({
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
    lobby: new CastFloorGlassMaterial({
      thickness: floorGlassThickness,
      tileSize: floorGlassTileSize,
    }),
    lobbyWindow: createLobbyWindowGlass(),
    // Low-iron museum display glass whose anti-reflective coating leaves a faint violet and green sheen at grazing angles.
    tunnel: new ClearGlassMaterial({
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
}

export function disposeArchitecturalGlassMaterials(materials: ArchitecturalGlassMaterials) {
  for (const material of new Set(Object.values(materials))) {
    material.dispose()
  }
}

/**
 * The Lobby’s cast pavers, set upright between the Lobby and the Salon and the Forge.
 *
 * Its own instance with the wall’s thickness and paver scale, writing depth like the floor glass and refracting every surface
 * drawn before it (including orbs, transmissive knots and the floor window).
 */
function createLobbyWindowGlass() {
  const material = new CastFloorGlassMaterial({
    thickness: salonWindow.thickness,
    tileSize: salonWindow.tileSize,
  })
  material.name = 'lobby-window-glass-heavy'
  return material
}
