import AtelierAmbience from '../base/AtelierAmbience.ts'

/** The Paint Orb’s quiet studio. */
export default class PaintAmbience extends AtelierAmbience {
  constructor() {
    super({
      id: 'mood-paint',
      title: 'Atelier',
      gain: 0.5,
    })
  }
}
