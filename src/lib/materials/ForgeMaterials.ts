import {atan, color, float, max, mix, mx_noise_float, normalWorldGeometry, positionLocal, positionWorld, select, smoothstep, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, line, visibleDetail} from './filters.ts'

/** The Forge’s lower walls are honed dark basalt; above the dado, warm lime plaster catches the rooflight without competing with the objects on the tables. */
export class ForgeWallMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      metalness: 0,
      roughness: 0.84,
    })
    const position = positionWorld
    const normal = normalWorldGeometry
    const along = select(normal.x.abs().greaterThan(normal.z.abs()), position.z, position.x)
    const footprint = max(along.fwidth(), position.y.fwidth())
    const detail = visibleDetail(footprint, 0.012)
    const limeCloud = mix(float(0.5), mx_noise_float(position.mul(0.72)).mul(0.5).add(0.5), detail)
    const fineLime = mix(float(0.5), mx_noise_float(position.mul(8)).mul(0.5).add(0.5), visibleDetail(footprint, 0.004))
    const dado = smoothstep(1.04, 1.09, position.y).oneMinus()
    const rail = line(position.y.sub(1.065), 0.018).mul(detail)
    const panel = line(along.div(1.8).fract().sub(0.5).mul(1.8), 0.004).mul(detail).mul(dado)
    const basaltCloud = mx_noise_float(vec3(along.mul(0.9), position.y.mul(1.7), 11)).mul(0.5).add(0.5)
    const basalt = mix(color('#394846'), color('#5a6864'), basaltCloud.mul(0.34)).mul(fineLime.sub(0.5).mul(0.08).add(1))
    const lime = color('#d3c6aa').mul(limeCloud.sub(0.5).mul(0.23).add(fineLime.sub(0.5).mul(0.025).add(1)))
    this.colorNode = mix(lime, basalt, dado).mul(panel.oneMinus().mul(0.15).add(0.85)).add(color('#9b7640').mul(rail))
    this.normalNode = heightNormal(fineLime.mul(0.0007).add(panel.mul(-0.0015)).mul(detail))
    this.roughnessNode = float(0.84).add(dado.mul(0.08)).add(rail.mul(-0.25))
  }
}

/** Large honed basalt flags with subtle slate veining, darkened so polished brass and work on the benches stay legible. */
export class ForgeFloorMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      metalness: 0.08,
      roughness: 0.72,
      envMapIntensity: 0.5,
    })
    const coordinate = positionWorld.xz.div(2)
    const cell = coordinate.floor()
    const local = coordinate.fract().sub(0.5)
    const checker = cell.x.add(cell.y).sub(cell.x.add(cell.y).div(2).floor().mul(2))
    const veins = mx_noise_float(vec3(positionWorld.x.mul(0.5), 7, positionWorld.z.mul(0.5))).mul(0.5).add(0.5)
    const pale = color('#555850')
    const dark = color('#333e3e')
    const fine = mx_noise_float(positionWorld.mul(18)).mul(0.5).add(0.5)
    this.colorNode = mix(dark, pale, checker.mul(0.35).add(0.12)).mul(veins.mul(0.13).add(fine.mul(0.035).add(0.91)))
    const worn = local.length().sub(0.55).smoothstep(-0.2, 0).mul(0.01)
    this.normalNode = heightNormal(fine.mul(0.0006).add(worn.mul(veins)))
  }
}

/** A blackened, lightly burnished iron trim that belongs to the Forge’s machinery rather than to domestic joinery. */
export class ForgeTrimMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      color: '#263331',
      metalness: 0.58,
      roughness: 0.48,
      envMapIntensity: 0.8,
    })
    const streak = mx_noise_float(vec3(positionWorld.x.mul(12), positionWorld.y.mul(2), positionWorld.z.mul(12))).mul(0.5).add(0.5)
    this.colorNode = color('#263331').mul(streak.mul(0.22).add(0.88))
    this.roughnessNode = float(0.43).add(streak.mul(0.12))
  }
}

/** Patinated copper-iron sheets in the Forge’s sloping hood, inlaid with twelve bronze ribs and concentric straps. */
export class ForgeCeilingMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      metalness: 0.42,
      roughness: 0.5,
    })
    const local = positionLocal
    const radial = local.xz.length()
    const turn = atan(local.z, local.x).add(Math.PI).div(Math.PI * 2).mul(12)
    const spoke = line(turn.fract().sub(0.5), 0.012)
    const strap = line(radial.div(1.55).fract().sub(0.5), 0.006)
    const strapBand = select(radial.greaterThan(2.6).and(radial.lessThan(7.8)), float(1), float(0))
    const seam = spoke.max(strap.mul(strapBand))
    const grain = mx_noise_float(local.mul(4)).mul(0.5).add(0.5)
    const copper = color('#405b53').mul(grain.mul(0.14).add(0.91))
    const bronze = color('#9c804b').mul(grain.mul(0.16).add(0.92))
    this.colorNode = mix(copper, bronze, seam)
    this.emissiveNode = mix(copper, bronze, seam).mul(0.23)
    this.roughnessNode = float(0.46).add(grain.mul(0.12)).add(seam.mul(-0.12))
    this.normalNode = heightNormal(grain.mul(0.001).sub(seam.mul(0.0014)))
  }
}
