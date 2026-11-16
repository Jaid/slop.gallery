import AtelierAmbience from '../base/AtelierAmbience.ts'

/** The Impasto Orb shares the atelier’s brush, palette-knife and rinsing sounds, with a loop identity of its own. */
export default class ImpastoAmbience extends AtelierAmbience {
  constructor() {
    super({
      id: 'mood-impasto',
      title: 'Impasto atelier',
      gain: 0.5,
    })
  }
}
