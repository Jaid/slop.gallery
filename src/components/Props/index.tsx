import Curio from '#component/Curio'
import GrabbableProp from '#src/components/Scene/GrabbableProp.tsx'
import {curios} from '#src/lib/gallery/curios/index.ts'
import {oculusLandingPlinths} from '#src/lib/gallery/lowerGallery.ts'
import gold from '#src/lib/materials/gold.ts'

const [westPlinth, eastPlinth] = oculusLandingPlinths
const plinthTop = (plinth: typeof westPlinth) => plinth.position[1] + plinth.height / 2

export default function Props() {
  return <>
    {/* On the can-shaped plinths behind the Oculus switchback landings */}
    <GrabbableProp id='prop-cube' orbit={{radius: Math.sqrt(3) * 0.15}} position={[westPlinth.position[0], plinthTop(westPlinth) + 0.15, westPlinth.position[2]]} rotation={[0, 0.4, 0]} title='A cube that has seen things' type='dynamic'>
      <mesh castShadow material={gold} receiveShadow><boxGeometry args={[0.3, 0.3, 0.3]} /></mesh>
    </GrabbableProp>
    <GrabbableProp id='prop-ring' orbit={{radius: 0.24}} position={[eastPlinth.position[0], plinthTop(eastPlinth) + 0.06, eastPlinth.position[2]]} rotation={[Math.PI / 2, 0, 0]} title='One ring, to keep things simple' type='dynamic'>
      <mesh castShadow material={gold} receiveShadow><torusGeometry args={[0.18, 0.06, 12, 32]} /></mesh>
    </GrabbableProp>
    {/* The pumpkin on the Banquet’s table, the hatchet in the Lodge and the helmet in the Bastion, which steer the flavor the Forge’s alchemy machine gives a Transparent Orb, and the painting set on the Forge’s painter’s table */}
    {curios.map(curio => <Curio key={curio.id} curio={curio} />)}
  </>
}
