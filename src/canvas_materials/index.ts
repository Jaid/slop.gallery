import type CanvasMaterial from './base/CanvasMaterial.ts'
import type {CanvasMaterialId} from './lib/canvasMaterialIds.ts'

import AzulejoCanvasMaterial from './azulejo/AzulejoCanvasMaterial.ts'
import BarytaCanvasMaterial from './baryta/BarytaCanvasMaterial.ts'
import CraquelureCanvasMaterial from './craquelure/CraquelureCanvasMaterial.ts'
import DiamondDustCanvasMaterial from './diamond-dust/DiamondDustCanvasMaterial.ts'
import GuillocheCanvasMaterial from './guilloche/GuillocheCanvasMaterial.ts'
import ImpastoCanvasMaterial from './impasto/ImpastoCanvasMaterial.ts'
import IntaglioRareCanvasMaterial from './intaglio-rare/IntaglioRareCanvasMaterial.ts'
import IsogiltCanvasMaterial from './isogilt/IsogiltCanvasMaterial.ts'
import LinenCanvasMaterial from './linen/LinenCanvasMaterial.ts'
import MoireCanvasMaterial from './moire/MoireCanvasMaterial.ts'
import NacreCanvasMaterial from './nacre/NacreCanvasMaterial.ts'
import PrismSweepCanvasMaterial from './prism-sweep/PrismSweepCanvasMaterial.ts'
import RagCanvasMaterial from './rag/RagCanvasMaterial.ts'
import SilverplateCanvasMaterial from './silverplate/SilverplateCanvasMaterial.ts'
import TrichromeCanvasMaterial from './trichrome/TrichromeCanvasMaterial.ts'
import WaxCanvasMaterial from './wax/WaxCanvasMaterial.ts'

/** every canvas material there is by its id */
export const canvasMaterials = {
  linen: new LinenCanvasMaterial,
  impasto: new ImpastoCanvasMaterial,
  nacre: new NacreCanvasMaterial,
  rag: new RagCanvasMaterial,
  wax: new WaxCanvasMaterial,
  baryta: new BarytaCanvasMaterial,
  moire: new MoireCanvasMaterial,
  silverplate: new SilverplateCanvasMaterial,
  trichrome: new TrichromeCanvasMaterial,
  isogilt: new IsogiltCanvasMaterial,
  'prism-sweep': new PrismSweepCanvasMaterial,
  'intaglio-rare': new IntaglioRareCanvasMaterial,
  craquelure: new CraquelureCanvasMaterial,
  azulejo: new AzulejoCanvasMaterial,
  guilloche: new GuillocheCanvasMaterial,
  'diamond-dust': new DiamondDustCanvasMaterial,
} as const satisfies Record<CanvasMaterialId, CanvasMaterial>

export type {CanvasMaterialId} from './lib/canvasMaterialIds.ts'
