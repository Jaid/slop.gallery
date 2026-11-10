import type PortraitFrame from './base/PortraitFrame.ts'
import type {PortraitFrameId} from './lib/frameParameter.ts'

import AbyssFrame from './abyss/AbyssFrame.ts'
import AcrylicFrame from './acrylic/AcrylicFrame.ts'
import AdamFrame from './adam/AdamFrame.ts'
import AuricularFrame from './auricular/AuricularFrame.ts'
import BarbizonFrame from './barbizon/BarbizonFrame.ts'
import BleedingFrame from './bleeding/BleedingFrame.ts'
import BrushesFrame from './brushes/BrushesFrame.ts'
import BurlFrame from './burl/BurlFrame.ts'
import ButcherFrame from './butcher/ButcherFrame.ts'
import CanvasFrame from './canvas/CanvasFrame.ts'
import CasingFrame from './casing/CasingFrame.ts'
import CharredFrame from './charred/CharredFrame.ts'
import CheckerFrame from './checker/CheckerFrame.ts'
import ClassicFrame from './classic/ClassicFrame.ts'
import CofferFrame from './coffer/CofferFrame.ts'
import CoffinFrame from './coffin/CoffinFrame.ts'
import ContainmentFrame from './containment/ContainmentFrame.ts'
import CrateFrame from './crate/CrateFrame.ts'
import DecoFrame from './deco/DecoFrame.ts'
import DichroicFrame from './dichroic/DichroicFrame.ts'
import EvidenceFrame from './evidence/EvidenceFrame.ts'
import FleshFrame from './flesh/FleshFrame.ts'
import FloatFrame from './float/FloatFrame.ts'
import GildingFrame from './gilding/GildingFrame.ts'
import ImpressionistFrame from './impressionist/ImpressionistFrame.ts'
import InfestedFrame from './infested/InfestedFrame.ts'
import KumikoFrame from './kumiko/KumikoFrame.ts'
import LanternFrame from './lantern/LanternFrame.ts'
import LeatherFrame from './leather/LeatherFrame.ts'
import {readFrame} from './lib/frameParameter.ts'
import LouisFrame from './louis/LouisFrame.ts'
import MaelstromFrame from './maelstrom/MaelstromFrame.ts'
import MarbledFrame from './marbled/MarbledFrame.ts'
import MawFrame from './maw/MawFrame.ts'
import MeanderFrame from './meander/MeanderFrame.ts'
import MeteoriteFrame from './meteorite/MeteoriteFrame.ts'
import MissionFrame from './mission/MissionFrame.ts'
import OakFrame from './oak/OakFrame.ts'
import OrbitFrame from './orbit/OrbitFrame.ts'
import OssuaryFrame from './ossuary/OssuaryFrame.ts'
import PaletteFrame from './palette/PaletteFrame.ts'
import PerspectiveFrame from './perspective/PerspectiveFrame.ts'
import RegolithFrame from './regolith/RegolithFrame.ts'
import RiftFrame from './rift/RiftFrame.ts'
import RippleFrame from './ripple/RippleFrame.ts'
import SeanceFrame from './seance/SeanceFrame.ts'
import SevresFrame from './sevres/SevresFrame.ts'
import SgraffitoFrame from './sgraffito/SgraffitoFrame.ts'
import StrapworkFrame from './strapwork/StrapworkFrame.ts'
import TrampFrame from './tramp/TrampFrame.ts'
import TravertineFrame from './travertine/TravertineFrame.ts'
import TwigFrame from './twig/TwigFrame.ts'
import VelvetFrame from './velvet/VelvetFrame.ts'
import VitrineFrame from './vitrine/VitrineFrame.ts'
import WhistlerFrame from './whistler/WhistlerFrame.ts'

/** the frame of every work whose room has none of its own */
export const classicFrame = new ClassicFrame
/** every frame there is by its id */
export const frames = {
  classic: classicFrame,
  abyss: new AbyssFrame,
  acrylic: new AcrylicFrame,
  adam: new AdamFrame,
  auricular: new AuricularFrame,
  barbizon: new BarbizonFrame,
  bleeding: new BleedingFrame,
  brushes: new BrushesFrame,
  burl: new BurlFrame,
  butcher: new ButcherFrame,
  canvas: new CanvasFrame,
  casing: new CasingFrame,
  charred: new CharredFrame,
  checker: new CheckerFrame,
  coffer: new CofferFrame,
  coffin: new CoffinFrame,
  containment: new ContainmentFrame,
  crate: new CrateFrame,
  deco: new DecoFrame,
  dichroic: new DichroicFrame,
  evidence: new EvidenceFrame,
  flesh: new FleshFrame,
  float: new FloatFrame,
  gilding: new GildingFrame,
  impressionist: new ImpressionistFrame,
  infested: new InfestedFrame,
  kumiko: new KumikoFrame,
  lantern: new LanternFrame,
  leather: new LeatherFrame,
  louis: new LouisFrame,
  maelstrom: new MaelstromFrame,
  marbled: new MarbledFrame,
  maw: new MawFrame,
  meander: new MeanderFrame,
  meteorite: new MeteoriteFrame,
  mission: new MissionFrame,
  oak: new OakFrame,
  orbit: new OrbitFrame,
  ossuary: new OssuaryFrame,
  palette: new PaletteFrame,
  perspective: new PerspectiveFrame,
  regolith: new RegolithFrame,
  rift: new RiftFrame,
  ripple: new RippleFrame,
  seance: new SeanceFrame,
  sevres: new SevresFrame,
  sgraffito: new SgraffitoFrame,
  strapwork: new StrapworkFrame,
  tramp: new TrampFrame,
  travertine: new TravertineFrame,
  twig: new TwigFrame,
  velvet: new VelvetFrame,
  vitrine: new VitrineFrame,
  whistler: new WhistlerFrame,
} as const satisfies Record<PortraitFrameId, PortraitFrame>

const forcedFrameId = readFrame()

/** the frame `?frame` makes every work wear instead of its own, read once at startup, or undefined */
export const forcedFrame: PortraitFrame | undefined = forcedFrameId ? frames[forcedFrameId] : undefined

/** The frame a work wears: the one `?frame` forces on every work, or else the one with the id, the default frame for none. */
export function portraitFrame(id?: PortraitFrameId): PortraitFrame {
  return forcedFrame ?? (id === undefined ? classicFrame : frames[id])
}

export type {PortraitFrameId} from './lib/frameParameter.ts'
