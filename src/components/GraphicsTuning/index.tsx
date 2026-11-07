import type {CustomGraphics} from '#src/lib/rendering/customGraphics.ts'

import Branch from 'branch-component'
import {useEffect} from 'react'
import {ACESFilmicToneMapping, AgXToneMapping, CineonToneMapping, LinearToneMapping, NeutralToneMapping, NoToneMapping, ReinhardToneMapping} from 'three/webgpu'
import useGraphicsMode from 'use-graphics-mode'
import {create} from 'zustand'

import {getDefaultCustomGraphics, useCustomGraphics, useGraphicsTuning} from '#src/lib/rendering/customGraphics.ts'
import {cinematicMaxTextureSize, readCinematicGraphics} from '#src/lib/rendering/graphicsMode.ts'
import {changeTunedGraphics, discardTuningBuffer, useTuningBuffer} from '#src/lib/rendering/tuningBuffer.ts'

import css from './style.module.sass'

type Setting = keyof CustomGraphics
type BooleanKey = {[Key in Setting]: CustomGraphics[Key] extends boolean ? Key : never}[Setting]
type NumberKey = {[Key in Setting]: CustomGraphics[Key] extends number ? Key : never}[Setting]
type Value = CustomGraphics[Setting]
/** A checkbox that switches a setting to `off` without losing its value, which the panel keeps to bring back when switched on again. */
type Switch = {
  /** the value to switch on to when the graphics mode starts with the setting off */
  fallback: Value
  key: Setting
  off: Value
}
type Control = ({
  key: BooleanKey
  kind: 'toggle'
} | {
  key: NumberKey
  kind: 'range'
  max: number
  min: number
  /** whether the value shows as a percentage */
  percent?: boolean
  step: number
} | {
  key: Setting
  kind: 'select'
  options: Array<[value: CustomGraphics[Setting], label: string]>
}) & {
  label: string
  /** the value a checkbox in front of the label switches the setting to */
  off?: Pick<Switch, 'fallback' | 'off'>
  /** whether the control does anything with the current settings, beyond its section being switched on */
  when?: (settings: CustomGraphics) => boolean
}
type Section = {
  controls: Array<Control>
  title: string
  /** the pass this section tunes, which its heading switches on and off, or the setting it switches off without losing */
  toggle?: BooleanKey | Switch
}

const range = (key: NumberKey, label: string, min: number, max: number, step: number): Control => ({
  key,
  kind: 'range',
  label,
  max,
  min,
  step,
})
/** a range of a fraction or factor, shown as a percentage */
const percent = (key: NumberKey, label: string, min: number, max: number, step: number): Control => ({
  key,
  kind: 'range',
  label,
  max,
  min,
  percent: true,
  step,
})
const toggle = (key: BooleanKey, label: string): Control => ({
  key,
  kind: 'toggle',
  label,
})
const select = (key: Setting, label: string, options: Array<[Value, string]>): Control => ({
  key,
  kind: 'select',
  label,
  options,
})
/** the brightest value a half-float target holds, so a cap there caps nothing */
const uncappedLuminance = 65_504
/** Cinematic graphics request a texture size limit that fits a 16384² map; heavy graphics stop at WebGPU’s default of 8192. */
const shadowMapSizes = [1024, 2048, 4096, 8192, ...readCinematicGraphics() ? [cinematicMaxTextureSize] : []]
const scales = (values: Array<number>): Array<[number, string]> => values.map(value => [value, `${value * 100}%`])
const lampShadowsCast = (settings: CustomGraphics) => settings.lampShadows > 0
const renderScales = scales([0.25, 0.5, 0.75, 1, 1.25, 1.5, 2])
const sections: Array<Section> = [
  {
    title: 'View',
    controls: [
      select('renderScale', 'Scale', renderScales.some(([value]) => value === useCustomGraphics.getState().renderScale) ? renderScales : [...renderScales, ...scales([useCustomGraphics.getState().renderScale])]),
      range('fov', 'Field of view', 30, 110, 1),
      select('toneMapping', 'Tone mapping', [[ACESFilmicToneMapping, 'ACES Filmic'], [AgXToneMapping, 'AgX'], [NeutralToneMapping, 'Neutral'], [ReinhardToneMapping, 'Reinhard'], [CineonToneMapping, 'Cineon'], [LinearToneMapping, 'Linear'], [NoToneMapping, 'None']]),
    ],
  },
  {
    title: 'Temporal antialiasing',
    toggle: {
      fallback: 'traa',
      key: 'antiAliasing',
      off: false,
    },
    controls: [],
  },
  {
    title: 'Mirror reflections',
    toggle: 'mirrorReflections',
    controls: [
      select('reflectionResolutionScale', 'Resolution', scales([0.5, 1, 2])),
      percent('mirrorReflectionStrength', 'Strength', 0, 4, 0.05),
      percent('mirrorReflectionGrazing', 'Grazing', 0, 4, 0.05),
      {
        ...percent('mirrorReflectionLevel', 'Loss', 0.05, 4, 0.05),
        off: {
          fallback: 1,
          off: 0,
        },
      },
      {
        ...percent('mirrorReflectionBlur', 'Gaussian blur', 0.05, 4, 0.05),
        off: {
          fallback: 1,
          off: 0,
        },
      },
      percent('mirrorReflectionRoughness', 'Roughness', 0, 4, 0.05),
    ],
  },
  {
    title: 'Screen-space reflections',
    toggle: 'screenSpaceReflections',
    controls: [
      select('screenSpaceReflectionResolutionScale', 'Resolution', scales([0.25, 0.5, 1])),
      percent('screenSpaceReflectionIntensity', 'Intensity', 0, 2, 0.1),
      range('screenSpaceReflectionDistance', 'Distance', 0.5, 20, 0.5),
      range('screenSpaceReflectionThickness', 'Thickness', 0.05, 1, 0.05),
    ],
  },
  {
    title: 'Ambient occlusion',
    toggle: 'ambientOcclusion',
    controls: [
      select('ambientOcclusionResolutionScale', 'Resolution', scales([0.5, 0.75, 1, 1.5, 2])),
      range('ambientOcclusionSamples', 'Samples', 4, 64, 4),
      range('ambientOcclusionRadius', 'Radius', 0.02, 1, 0.02),
      range('ambientOcclusionThickness', 'Thickness', 0.1, 3, 0.1),
      percent('ambientOcclusionScale', 'Strength', 0, 2, 0.05),
      toggle('ambientOcclusionTemporalFiltering', 'Temporal filtering'),
    ],
  },
  {
    title: 'Screen-space indirect light',
    toggle: 'screenSpaceIndirectLight',
    controls: [
      select('screenSpaceIndirectLightResolutionScale', 'Resolution', scales([0.5, 0.75, 1, 1.5, 2])),
      range('screenSpaceIndirectLightIntensity', 'Intensity', 0, 16, 0.5),
      range('screenSpaceIndirectLightRadius', 'Radius', 1, 32, 1),
      range('screenSpaceIndirectLightSlices', 'Slices', 1, 4, 1),
      range('screenSpaceIndirectLightSteps', 'Steps', 4, 32, 4),
      range('screenSpaceIndirectLightThickness', 'Thickness', 0.1, 4, 0.1),
      range('screenSpaceIndirectLightExpFactor', 'Exp factor', 1, 4, 0.1),
      {
        ...percent('screenSpaceIndirectLightBackfaceLighting', 'Backface lighting', 0.05, 1, 0.05),
        off: {
          fallback: 0.5,
          off: 0,
        },
      },
      {
        ...range('screenSpaceIndirectLightAmbientOcclusion', 'AO intensity', 0.1, 4, 0.1),
        off: {
          fallback: 1,
          off: 0,
        },
      },
      toggle('screenSpaceIndirectLightTemporalFiltering', 'Temporal filtering'),
    ],
  },
  {
    title: 'Voxel indirect light',
    toggle: 'voxelIndirectLight',
    controls: [
      select('voxelIndirectLightResolution', 'Voxels', [[64, '64³'], [128, '128³'], [256, '256³']]),
      range('voxelIndirectLightIntensity', 'Intensity', 0, 0.5, 0.01),
      range('voxelIndirectLightBounces', 'Bounces', 0, 4, 1),
      range('voxelIndirectLightConeCount', 'Cones', 1, 9, 1),
      range('voxelIndirectLightConeAngle', 'Cone angle', 10, 80, 5),
    ],
  },
  {
    title: 'Volumetric sunlight',
    toggle: 'volumetricLight',
    controls: [
      select('volumetricLightResolutionScale', 'Resolution', scales([0.25, 0.5, 1])),
      range('volumetricLightDensity', 'Density', 0, 20, 0.5),
      percent('volumetricLightMaxDensity', 'Max density', 0, 1, 0.05),
      range('volumetricLightSteps', 'Steps', 16, 256, 16),
      range('volumetricLightDistanceAttenuation', 'Attenuation', 0, 8, 0.25),
      {
        ...select('volumetricLightBlur', 'Blur', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [6, '6'], [8, '8']]),
        off: {
          fallback: 3,
          off: 0,
        },
      },
    ],
  },
  {
    title: 'Contact shadows',
    toggle: 'contactShadows',
    controls: [
      select('contactShadowResolutionScale', 'Resolution', scales([0.5, 0.75, 1])),
      range('contactShadowDistance', 'Distance', 0.01, 0.5, 0.01),
      range('contactShadowThickness', 'Thickness', 0.005, 0.1, 0.005),
      percent('contactShadowIntensity', 'Intensity', 0, 1, 0.05),
      range('contactShadowQuality', 'Quality', 0.1, 2, 0.1),
      toggle('contactShadowDenoise', 'Denoise'),
      {
        ...range('contactShadowDenoiseRadius', 'Denoise radius', 1, 16, 1),
        when: settings => settings.contactShadowDenoise,
      },
    ],
  },
  {
    title: 'Bloom',
    toggle: 'bloom',
    controls: [
      select('bloomResolutionScale', 'Resolution', scales([0.125, 0.25, 0.375, 0.5, 0.75, 1])),
      select('bloomMipCount', 'Blur mips', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']]),
      select('bloomGaussianKernelSize', 'Gaussian kernel size', [[2, '2'], [4, '4'], [6, '6'], [8, '8'], [10, '10'], [12, '12']]),
      percent('bloomStrength', 'Strength', 0, 2, 0.1),
      range('bloomRadius', 'Radius', 0, 1, 0.05),
      range('bloomThreshold', 'Threshold', 0, 4, 0.1),
      range('bloomSmoothWidth', 'Smooth width', 0, 0.5, 0.01),
      {
        ...range('bloomLuminanceCap', 'Brightness cap', 1, 64, 1),
        off: {
          fallback: 8,
          off: uncappedLuminance,
        },
      },
    ],
  },
  {
    title: 'Sun',
    toggle: 'sun',
    controls: [
      range('sunIntensity', 'Strength', 0, 8, 0.1),
      range('sunAzimuth', 'Azimuth', 0, 360, 1),
      range('sunElevation', 'Elevation', 0, 90, 1),
      select('sunShadowMapSize', 'Shadow map', shadowMapSizes.map(size => [size, `${size}²`])),
      range('sunShadowSamples', 'Shadow samples', 1, 32, 1),
      range('sunShadowRadius', 'Shadow filter radius', 0, 8, 0.25),
    ],
  },
  {
    title: 'Lamps',
    toggle: {
      fallback: 'all',
      key: 'lampSet',
      off: 'none',
    },
    controls: [
      select('lampSet', 'Lamps', [['all', 'All'], ['essential', 'Essential']]),
      percent('lamps', 'Multiplier', 0, 4, 0.05),
      {
        ...percent('lampShadows', 'Shadows', 0.05, 1, 0.05),
        off: {
          fallback: 1,
          off: 0,
        },
      },
      {
        ...range('lampShadowSamples', 'Shadow samples', 1, 32, 1),
        when: lampShadowsCast,
      },
      {
        ...range('lampShadowRadius', 'Shadow filter radius', 0, 8, 0.25),
        when: lampShadowsCast,
      },
    ],
  },
  {
    title: 'Lighting',
    toggle: 'fill',
    controls: [
      {
        ...range('hemisphereIntensity', 'Base light', 0.1, 4, 0.1),
        off: {
          fallback: 1,
          off: 0,
        },
      },
      {
        ...percent('environmentIntensity', 'Environment', 0.05, 1, 0.05),
        off: {
          fallback: 1,
          off: 0,
        },
      },
    ],
  },
  {
    title: 'Finish',
    controls: [
      {
        ...percent('vignette', 'Vignette', 0.05, 1, 0.05),
        off: {
          fallback: 0.2,
          off: 0,
        },
      },
      toggle('dither', 'Dither'),
    ],
  },
]
const switches: Array<Switch> = sections.flatMap(section => [
  ...typeof section.toggle === 'object' ? [section.toggle] : [],
  ...section.controls.filter(control => control.off).map(control => ({
    ...control.off!,
    key: control.key,
  })),
])
const findSwitch = (key: Setting) => switches.find(candidate => candidate.key === key)
/** the values the panel opened with, which a label turns yellow once it leaves */
const initial = getDefaultCustomGraphics()
const initialParked: Partial<Record<Setting, Value>> = Object.fromEntries(switches.filter(({key, off}) => initial[key] === off).map(({fallback, key}) => [key, fallback]))
/** the values of the settings a checkbox switched off, which come back when it switches them on again */
const useParkedGraphics = create<Partial<Record<Setting, Value>>>(() => initialParked)
const set = (values: Partial<CustomGraphics>, parked?: Partial<Record<Setting, Value>>) => {
  changeTunedGraphics(() => {
    if (parked) {
      useParkedGraphics.setState(parked, true)
    }
    useCustomGraphics.setState(values)
  })
}
const reset = (keys: Array<Setting>) => {
  const parked = {...useParkedGraphics.getState()}
  for (const key of keys) {
    if (key in initialParked) {
      parked[key] = initialParked[key]
    } else {
      delete parked[key]
    }
  }
  set(Object.fromEntries(keys.map(key => [key, initial[key]])), parked)
}
/** Switches a setting off, keeping its value, or back on to the kept one. */
const switchSetting = ({fallback, key, off}: Switch, on: boolean) => {
  const {[key]: kept, ...parked} = useParkedGraphics.getState()
  if (on) {
    set({[key]: kept ?? fallback}, parked)
  } else {
    set({[key]: off}, {
      ...parked,
      [key]: useCustomGraphics.getState()[key],
    })
  }
}
/** whether a setting differs from the one the panel opened with, counting the kept value of a switched-off one */
const isChanged = (state: CustomGraphics, parked: Partial<Record<Setting, Value>>, key: Setting) => state[key] !== initial[key] || parked[key] !== initialParked[key]
/** Keeps the second click of a double-click from reaching the label’s control, so double-clicking a checkbox’s label resets it instead of switching it twice. */
const ignoreRepeatedClick = (event: React.MouseEvent) => {
  if (event.detail > 1) {
    event.preventDefault()
  }
}
/** The panel G shows with `?development`, a column left of the canvas: checkboxes switch passes, which rebuilds the pipeline, and sliders change its uniforms live. */
export default function GraphicsTuning() {
  const isHeavy = useGraphicsMode()
  useEffect(() => {
    // Holding Space over the panel shows the frame from before the latest tweak; it is caught before the focused control or the game sees it.
    const show = (event: KeyboardEvent) => {
      if (event.code === 'Space' && useGraphicsTuning.getState().hovered) {
        event.preventDefault()
        event.stopPropagation()
        useTuningBuffer.setState({showing: true})
      }
    }
    const hide = (event: KeyboardEvent) => {
      if (event.code === 'Space' && useTuningBuffer.getState().showing) {
        event.preventDefault()
        event.stopPropagation()
        useTuningBuffer.setState({showing: false})
      }
    }
    const release = () => useTuningBuffer.setState({showing: false})
    addEventListener('keydown', show, {capture: true})
    addEventListener('keyup', hide, {capture: true})
    addEventListener('blur', release)
    return () => {
      removeEventListener('keydown', show, {capture: true})
      removeEventListener('keyup', hide, {capture: true})
      removeEventListener('blur', release)
      // G hid the panel.
      discardTuningBuffer()
    }
  }, [])
  return <aside
    className={css.container} aria-label='Render pipeline' onPointerEnter={() => useGraphicsTuning.setState({hovered: true})} onPointerLeave={() => {
      useGraphicsTuning.setState({hovered: false})
      useTuningBuffer.setState({showing: false})
    }}
  >
    <div className={css.heading}><h2>Render pipeline</h2><button type='button' onClick={() => set(initial, initialParked)}>Reset</button></div>
    <p className={css.hint}>{isHeavy ? 'Pause to tune. The menu hides while the pointer is over the panel. Double-click a label to reset it. Hold Space to see the frame from before the latest change.' : 'Switch graphics on in the menu to tune the pipeline.'}</p>
    <Branch if={isHeavy}>{sections.map(section => <SectionBox key={section.title} section={section} />)}</Branch>
  </aside>
}
function ControlRow({control, disabled}: {
  control: Control
  disabled: boolean
}) {
  const current = useCustomGraphics(state => state[control.key])
  const parked = useParkedGraphics(state => state[control.key])
  const applies = useCustomGraphics(state => control.when?.(state) ?? true)
  // A switched-off setting, by its own checkbox or its section’s, shows the value it keeps.
  const valueSwitch = findSwitch(control.key)
  const isOff = current === valueSwitch?.off
  const value = isOff ? parked ?? valueSwitch.fallback : current
  const changed = current !== initial[control.key] || parked !== initialParked[control.key]
  const id = `tuning-${control.key}`
  const label = <span data-changed={changed || undefined} onClick={ignoreRepeatedClick} onDoubleClick={() => reset([control.key])}>
    <Branch if={control.off}><input aria-label={`${control.label} on`} checked={!isOff} disabled={disabled} type='checkbox' onChange={event => switchSetting(valueSwitch!, event.currentTarget.checked)} /></Branch>
    {control.label}
  </span>
  disabled ||= !applies || control.off !== undefined && isOff
  if (control.kind === 'toggle') {
    return <label className={css.toggle}>{label}<input id={id} checked={value as boolean} disabled={disabled} type='checkbox' onChange={event => set({[control.key]: event.currentTarget.checked})} /></label>
  }
  if (control.kind === 'select') {
    const index = control.options.findIndex(([option]) => option === value)
    return <label className={css.row}>{label}<select id={id} disabled={disabled} value={index} onChange={event => set({[control.key]: control.options[Number(event.currentTarget.value)][0]})}>{control.options.map(([, optionLabel], optionIndex) => <option key={optionLabel} value={optionIndex}>{optionLabel}</option>)}</select></label>
  }
  return <label className={css.row}>
    {label}
    <input id={id} disabled={disabled} max={control.max} min={control.min} step={control.step} type='range' value={value as number} onChange={event => set({[control.key]: Number(event.currentTarget.value)})} />
    <output htmlFor={id}>{control.percent ? `${Math.round((value as number) * 100)}%` : Number((value as number).toFixed(3))}</output>
  </label>
}
function SectionBox({section}: {section: Section}) {
  const {toggle: sectionToggle} = section
  const enabled = useCustomGraphics(state => {
    if (sectionToggle === undefined) {
      return true
    }
    return typeof sectionToggle === 'object' ? state[sectionToggle.key] !== sectionToggle.off : state[sectionToggle]
  })
  const toggleKey = typeof sectionToggle === 'object' ? sectionToggle.key : sectionToggle
  const keys = [...new Set([...toggleKey === undefined ? [] : [toggleKey], ...section.controls.map(control => control.key)])]
  const parked = useParkedGraphics()
  const changed = useCustomGraphics(state => keys.some(key => isChanged(state, parked, key)))
  const onToggle = (on: boolean) => {
    if (typeof sectionToggle === 'object') {
      switchSetting(sectionToggle, on)
    } else {
      set({[sectionToggle!]: on})
    }
  }
  return <fieldset className={css.section}>
    <legend data-changed={changed || undefined} onClick={ignoreRepeatedClick} onDoubleClick={() => reset(keys)}><Branch if={sectionToggle} else={section.title}><label><input checked={enabled} type='checkbox' onChange={event => onToggle(event.currentTarget.checked)} /> {section.title}</label></Branch></legend>
    {section.controls.map(control => <ControlRow key={control.key} control={control} disabled={!enabled} />)}
  </fieldset>
}
