import type PortraitFrame from './base/PortraitFrame.ts'
import type {PortraitFrameId} from './frameParameter.ts'

import AntechamberAdamFrame from './AntechamberAdamFrame.ts'
import BanquetCheckerFrame from './BanquetCheckerFrame.ts'
import BanquetDecoFrame from './BanquetDecoFrame.ts'
import BanquetPerspectiveFrame from './BanquetPerspectiveFrame.ts'
import BastionOakFrame from './BastionOakFrame.ts'
import BastionStrapworkFrame from './BastionStrapworkFrame.ts'
import CellCofferFrame from './CellCofferFrame.ts'
import ClassicFrame from './ClassicFrame.ts'
import CorridorKumikoFrame from './CorridorKumikoFrame.ts'
import CorridorMissionFrame from './CorridorMissionFrame.ts'
import ExhibitionContainmentFrame from './ExhibitionContainmentFrame.ts'
import ExhibitionEvidenceFrame from './ExhibitionEvidenceFrame.ts'
import ExhibitionVitrineFrame from './ExhibitionVitrineFrame.ts'
import ForgeMeanderFrame from './ForgeMeanderFrame.ts'
import {readFrame} from './frameParameter.ts'
import HalloweenLanternFrame from './HalloweenLanternFrame.ts'
import HorrorBleedingFrame from './HorrorBleedingFrame.ts'
import HorrorButcherFrame from './HorrorButcherFrame.ts'
import HorrorFleshFrame from './HorrorFleshFrame.ts'
import HorrorInfestedFrame from './HorrorInfestedFrame.ts'
import HorrorMawFrame from './HorrorMawFrame.ts'
import LobbyLouisFrame from './LobbyLouisFrame.ts'
import LobbyTravertineFrame from './LobbyTravertineFrame.ts'
import LodgeCharredFrame from './LodgeCharredFrame.ts'
import LodgeTrampFrame from './LodgeTrampFrame.ts'
import LodgeTwigFrame from './LodgeTwigFrame.ts'
import MoonfallMeteoriteFrame from './MoonfallMeteoriteFrame.ts'
import MoonfallOrbitFrame from './MoonfallOrbitFrame.ts'
import MoonfallRegolithFrame from './MoonfallRegolithFrame.ts'
import OculusAcrylicFrame from './OculusAcrylicFrame.ts'
import OculusFloatFrame from './OculusFloatFrame.ts'
import SalonBarbizonFrame from './SalonBarbizonFrame.ts'
import SalonImpressionistFrame from './SalonImpressionistFrame.ts'
import SalonWhistlerFrame from './SalonWhistlerFrame.ts'
import SiennaBurlFrame from './SiennaBurlFrame.ts'
import SiennaLeatherFrame from './SiennaLeatherFrame.ts'
import SiennaVelvetFrame from './SiennaVelvetFrame.ts'
import SpookAbyssFrame from './SpookAbyssFrame.ts'
import SpookMaelstromFrame from './SpookMaelstromFrame.ts'
import SpookRiftFrame from './SpookRiftFrame.ts'
import SpookSeanceFrame from './SpookSeanceFrame.ts'
import VesperRippleFrame from './VesperRippleFrame.ts'
import VesperSgraffitoFrame from './VesperSgraffitoFrame.ts'

/** the frame of every work whose room has none of its own */
export const classicFrame = new ClassicFrame
/** every frame there is by its id */
export const frames = {
  classic: classicFrame,
  'lobby-travertine': new LobbyTravertineFrame,
  'lobby-louis': new LobbyLouisFrame,
  'vesper-ripple': new VesperRippleFrame,
  'vesper-sgraffito': new VesperSgraffitoFrame,
  'banquet-perspective': new BanquetPerspectiveFrame,
  'banquet-deco': new BanquetDecoFrame,
  'banquet-checker': new BanquetCheckerFrame,
  'antechamber-adam': new AntechamberAdamFrame,
  'sienna-velvet': new SiennaVelvetFrame,
  'sienna-burl': new SiennaBurlFrame,
  'sienna-leather': new SiennaLeatherFrame,
  'salon-barbizon': new SalonBarbizonFrame,
  'salon-whistler': new SalonWhistlerFrame,
  'salon-impressionist': new SalonImpressionistFrame,
  'forge-meander': new ForgeMeanderFrame,
  'moonfall-meteorite': new MoonfallMeteoriteFrame,
  'moonfall-orbit': new MoonfallOrbitFrame,
  'moonfall-regolith': new MoonfallRegolithFrame,
  'bastion-strapwork': new BastionStrapworkFrame,
  'bastion-oak': new BastionOakFrame,
  'lodge-twig': new LodgeTwigFrame,
  'lodge-tramp': new LodgeTrampFrame,
  'lodge-charred': new LodgeCharredFrame,
  'corridor-kumiko': new CorridorKumikoFrame,
  'corridor-mission': new CorridorMissionFrame,
  'oculus-float': new OculusFloatFrame,
  'oculus-acrylic': new OculusAcrylicFrame,
  'exhibition-vitrine': new ExhibitionVitrineFrame,
  'exhibition-evidence': new ExhibitionEvidenceFrame,
  'exhibition-containment': new ExhibitionContainmentFrame,
  'cell-coffer': new CellCofferFrame,
  'halloween-lantern': new HalloweenLanternFrame,
  'horror-flesh': new HorrorFleshFrame,
  'horror-bleeding': new HorrorBleedingFrame,
  'horror-butcher': new HorrorButcherFrame,
  'horror-infested': new HorrorInfestedFrame,
  'horror-maw': new HorrorMawFrame,
  'spook-maelstrom': new SpookMaelstromFrame,
  'spook-rift': new SpookRiftFrame,
  'spook-abyss': new SpookAbyssFrame,
  'spook-seance': new SpookSeanceFrame,
} as const satisfies Record<PortraitFrameId, PortraitFrame>

const forcedFrameId = readFrame()

/** the frame `?frame` makes every work wear instead of its own, read once at startup, or undefined */
export const forcedFrame: PortraitFrame | undefined = forcedFrameId ? frames[forcedFrameId] : undefined

/** The frame a work wears: the one `?frame` forces on every work, or else the one with the id, the default frame for none. */
export function portraitFrame(id?: PortraitFrameId): PortraitFrame {
  return forcedFrame ?? (id === undefined ? classicFrame : frames[id])
}

export type {PortraitFrameId} from './frameParameter.ts'
