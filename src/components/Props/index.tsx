import Curio from '#component/Curio'
import {curios} from '#src/lib/gallery/curios/index.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

/** the curios lying in rooms in reach, see `World.reach` */
const present = curios.filter(curio => slopGallery.reach.covers(curio.room))

export default function Props() {
  return <>
    {/* The pumpkin on the Banquet’s table, the hatchet in the Lodge and the helmet in the Bastion, which steer the flavor the Forge’s alchemy machine gives a Transparent Orb, and the painting set on the Forge’s painter’s table and the palette knife on its side table */}
    {present.map(curio => <Curio key={curio.id} curio={curio} />)}
  </>
}
