import Curio from '#component/Curio'
import {curios} from '#src/lib/gallery/curios/index.ts'

export default function Props() {
  return <>
    {/* The pumpkin on the Banquet’s table, the hatchet in the Lodge, the helmet in the Bastion and the palette knife in the Salon, which steer the flavor the Forge’s alchemy machine gives a Transparent Orb, and the painting set on the Forge’s painter’s table */}
    {curios.map(curio => <Curio key={curio.id} curio={curio} />)}
  </>
}
