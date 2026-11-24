import type {TuningChange, TuningModuleDump} from '#src/lib/worldTuning/index.ts'

import {isDevelopmentMode} from '#src/lib/developmentMode.ts'
import worldTuning from '#src/lib/worldTuning/index.ts'
import {useWorldTuningPanel} from '#src/lib/worldTuning/panel.ts'

/** the world tuning as the `get_world_tuning` tool tells it */
export type WorldTuningDump = {
  /** whether the page was opened with `?development`, without which no value takes effect */
  development: boolean
  /** every module this page has */
  modules: Array<TuningModuleDump>
  /** whether the panel shows */
  open: boolean
}

export type WorldTuningInput = {
  /** values by their keys by the id of their module, null for the one the page started with */
  values: Record<string, Record<string, unknown>>
}

export type WorldTuningChange = {
  /** every value that changed */
  changes: Array<TuningChange>
}

/** Every module of the world tuning with every value it shows, see the `get_world_tuning` tool. */
export function dumpWorldTuning(): WorldTuningDump {
  return {
    development: isDevelopmentMode,
    open: useWorldTuningPanel.getState().open,
    modules: worldTuning.describe(),
  }
}

/** Sets values of the world tuning like its panel does, see the `set_world_tuning` tool. */
export function setWorldTuning({values}: WorldTuningInput): WorldTuningChange {
  if (!isDevelopmentMode) {
    throw new Error('The world tuning only takes effect on a page opened with ?development, which this one was not.')
  }
  return {changes: worldTuning.set(values, 'webmcp')}
}
