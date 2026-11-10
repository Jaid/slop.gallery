import AntechamberMood from './antechamber/AntechamberMood.ts'
import ArenaMood from './arena/ArenaMood.ts'
import BanquetMood from './banquet/BanquetMood.ts'
import BastionMood from './bastion/BastionMood.ts'
import CellMood from './cell/CellMood.ts'
import CorridorMood from './corridor/CorridorMood.ts'
import ExhibitionMood from './exhibition/ExhibitionMood.ts'
import ForgeMood from './forge/ForgeMood.ts'
import FusionMood from './fusion/FusionMood.ts'
import HalloweenMood from './halloween/HalloweenMood.ts'
import HorrorMood from './horror/HorrorMood.ts'
import LobbyMood from './lobby/LobbyMood.ts'
import LodgeMood from './lodge/LodgeMood.ts'
import MoonfallMood from './moonfall/MoonfallMood.ts'
import OculusMood from './oculus/OculusMood.ts'
import PaintMood from './paint/PaintMood.ts'
import SalonMood from './salon/SalonMood.ts'
import SiennaMood from './sienna/SiennaMood.ts'
import SpookMood from './spook/SpookMood.ts'
import VesperMood from './vesper/VesperMood.ts'

/** every mood there is by its id: those the rooms name as their own and those cast over the world, like the fusion’s and the orbs’ */
export const moods = {
  antechamber: new AntechamberMood,
  arena: new ArenaMood,
  banquet: new BanquetMood,
  bastion: new BastionMood,
  cell: new CellMood,
  corridor: new CorridorMood,
  exhibition: new ExhibitionMood,
  forge: new ForgeMood,
  fusion: new FusionMood,
  halloween: new HalloweenMood,
  horror: new HorrorMood,
  lobby: new LobbyMood,
  lodge: new LodgeMood,
  moonfall: new MoonfallMood,
  oculus: new OculusMood,
  paint: new PaintMood,
  salon: new SalonMood,
  sienna: new SiennaMood,
  spook: new SpookMood,
  vesper: new VesperMood,
} as const

/** the id of one of the moods */
export type MoodId = keyof typeof moods

export type {default as Mood} from './base/Mood.ts'
