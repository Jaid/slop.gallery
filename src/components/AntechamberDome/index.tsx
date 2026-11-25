import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo} from 'react'
import {CircleGeometry, DoubleSide, ExtrudeGeometry, Path, Quaternion, Shape, Vector3} from 'three/webgpu'

import antechamberDome, {antechamberDomeGeometry, antechamberGlassPlacements, antechamberLatticeGeometry, antechamberLatticeY} from '#src/lib/gallery/antechamberDome.ts'
import StainedGlassMaterial from '#src/lib/materials/StainedGlassMaterial.ts'
import StarryVaultMaterial from '#src/lib/materials/StarryVaultMaterial.ts'

/** one palette per ring of windows, from the bottom up */
const palettes = [
  {
    border: hsl.integer(152, 92, 56),
    center: hsl.integer(74, 100, 79.2),
    petals: [hsl.integer(22, 94, 50), hsl.integer(266.6, 93, 41.5)],
  },
  {
    border: hsl.integer(22, 94, 50),
    center: hsl.integer(96, 100, 94.4),
    petals: [hsl.integer(266.6, 93, 41.5), hsl.integer(74, 100, 79.2)],
  },
] as const

/** The Antechamber’s ceiling, around its center: a flat slab like the other rooms’, opened up into a dome painted as a starry vault, with stained-glass windows and a brass lattice at its crown. */
export default function AntechamberDome({height, size}: {
  height: number
  size: readonly [number, number]
}) {
  const {radius, springY} = antechamberDome
  const vault = useDisposable(useMemo(() => new StarryVaultMaterial, []))
  const geometry = useDisposable(useMemo(() => {
    const outline = new Shape
    outline.moveTo(-size[0] / 2, -size[1] / 2)
    outline.lineTo(size[0] / 2, -size[1] / 2)
    outline.lineTo(size[0] / 2, size[1] / 2)
    outline.lineTo(-size[0] / 2, size[1] / 2)
    outline.closePath()
    const opening = new Path
    opening.absarc(0, 0, radius, 0, Math.PI * 2, true)
    outline.holes.push(opening)
    const slab = new ExtrudeGeometry(outline, {
      bevelEnabled: false,
      curveSegments: 160,
      depth: 0.18,
    })
    const dome = antechamberDomeGeometry()
    const lattice = antechamberLatticeGeometry()
    const pane = new CircleGeometry(1, 64)
    const glass = palettes.map(palette => new StainedGlassMaterial(palette))
    const front = new Vector3(0, 0, 1)
    const panes = antechamberGlassPlacements().map(placement => {
      const quaternion = new Quaternion
      quaternion.setFromUnitVectors(front, placement.normal)
      return {
        ...placement,
        material: glass[placement.ring],
        quaternion,
      }
    })
    return {
      dome,
      lattice,
      panes,
      pane,
      slab,
      dispose() {
        slab.dispose()
        dome.dispose()
        lattice.dispose()
        pane.dispose()
        for (const material of glass) {
          material.dispose()
        }
      },
    }
  }, [radius, size]))
  return <group name='antechamber-dome'>
    <mesh castShadow geometry={geometry.slab} name='antechamber-ceiling' position={[0, height - 0.11, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}><meshStandardNodeMaterial color={hsl.integer(93, 24, 88)} roughness={0.7} /></mesh>
    {/* Seen from inside, the shell shows its back faces, which have to cast the sun’s shadow too. */}
    <mesh castShadow geometry={geometry.dome} material={vault} name='antechamber-dome-shell' position={[0, springY, 0]} receiveShadow />
    <group name='antechamber-dome-glass' position={[0, springY, 0]}>
      {geometry.panes.map(({center, material, quaternion, radius: paneRadius}, index) => <mesh key={index} castShadow geometry={geometry.pane} material={material} position={center} quaternion={quaternion} scale={paneRadius} />)}
    </group>
    <mesh castShadow name='antechamber-dome-ring' position={[0, springY, 0]} receiveShadow rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[radius, 0.07, 12, 160]} /><meshStandardNodeMaterial color={hsl.integer(76, 52, 63)} metalness={0.8} roughness={0.35} /></mesh>
    <mesh castShadow geometry={geometry.lattice} name='antechamber-oculus-lattice' position={[0, springY + antechamberLatticeY, 0]} receiveShadow><meshStandardNodeMaterial color={hsl.integer(76, 52, 63)} metalness={0.8} roughness={0.35} side={DoubleSide} /></mesh>
  </group>
}
