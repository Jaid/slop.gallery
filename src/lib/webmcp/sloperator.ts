/** a sight of the Sloperator and what he is up to there */
export type SloperatorDump = {
  /** how the physics found his seat on the player entering its fence, like the `gallery.sloperator_spawn` event: `present`, `moved` or `missing` where he turned up, `none` where he stands at a sight without a seat, `moved` or `blocked` where he stays away; left out until then */
  detection?: 'blocked' | 'missing' | 'moved' | 'none' | 'present'
  /** the id of the fence the player has to be in for him to turn up there */
  fence: string
  id: string
  /** whether the `spawn_sloperator` tool brought him there, where he is whatever fence the player is in, until he leaves his Slop there */
  pinned: boolean
  /** how he sits or stands, or sat or stood where he left his Slop: `sit` on a bench, `sit_armchair` leaning back in an armchair, or `stand`; left out without a position */
  pose?: 'sit' | 'sit_armchair' | 'stand'
  /** where he is, or where he left his Slop: the point on the floor under him, in world meters; left out without either */
  position?: [number, number, number]
  /** how far his seat strayed from where it stood when the game began, as it stands now: how far the spot he sits on moved along the floor, in meters, and how far the seat turned around y and leans from upright, in radians; left out at a sight without a seat and where the world has no such seat */
  seat?: {
    moved: number
    tilted: number
    turned: number
  }
  /** whether the player caught sight of him there since entering its fence */
  sighted: boolean
  /** `away` while the player is out of its fence, `waiting` in it until the physics placed him on its next step, `seated` on his seat, `standing` where it stood or at a sight without a seat, `kept_away` where something lies in the box he would stand in, `slopped` once he left his Slop there, never to return */
  state: 'away' | 'kept_away' | 'seated' | 'slopped' | 'standing' | 'waiting'
  /** which way he faces there, as his turn around y in radians; left out without a position */
  yaw?: number
}
export type SloperatorSpawnInput = {
  /** the id of the sight; every sight whose fence the player’s place is in without one */
  sight?: string
}
export type SloperatorSightingInput = {
  /** whether he is in his sight pose right away instead of moving into it */
  instant?: boolean
  /** the id of the sight; every sight he is drawn at and was not caught sight of yet without one */
  sight?: string
}
/** the player catching sight of him, as the `gallery.sloperator_sight` event tells it */
export type SloperatorSightingDump = {
  /** how far from the eye the middle of him was, in meters */
  distance: number
  /** how he sat or stood */
  pose: 'sit' | 'sit_armchair' | 'stand'
  /** where the eye was, in world meters */
  position: [number, number, number]
  /** the id of the sight */
  sight: string
}
/** what the world that has the Sloperator does for his tools */
export type SloperatorControls = {
  dump: () => Array<SloperatorDump>
  sight: (input: SloperatorSightingInput) => Array<SloperatorSightingDump>
  spawn: (input: SloperatorSpawnInput) => Promise<Array<SloperatorDump>>
}

let source: SloperatorControls | undefined
/** What a world without him does for a tool: nothing without a sight, as there is none, or fails for the sight it was asked about. */
const absent = ({sight}: {sight?: string}) => {
  if (sight !== undefined) {
    throw new Error('This world has no Sloperator.')
  }
  return []
}

/** Lets the world that has the Sloperator answer his tools; returns the withdrawal. */
export function provideSloperator(controls: SloperatorControls) {
  source = controls
  return () => {
    if (source === controls) {
      source = undefined
    }
  }
}

/** Every sight of the Sloperator in the world and what he is up to there, or none in a world without him; see the `dump_sloperator` tool. */
export function dumpSloperator(): Array<SloperatorDump> {
  return source?.dump() ?? []
}

/** Brings him to a sight, or to every sight whose fence the player’s place is in, right away and keeps him there, and resolves once he is drawn there, or kept away, with what he is up to at each of them now, none where there is no such sight; see the `spawn_sloperator` tool. */
export async function spawnSloperator(input: SloperatorSpawnInput) {
  return source ? source.spawn(input) : absent(input)
}

/** Has the player catch sight of him at a sight, or wherever he is drawn and was not caught sight of yet, as if aiming at him zoomed in, and tells how, none where there is no such sight; see the `trigger_sloperator_sighting` tool. */
export function triggerSloperatorSighting(input: SloperatorSightingInput) {
  return source ? source.sight(input) : absent(input)
}
