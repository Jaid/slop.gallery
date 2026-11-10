import {describe, expect, test} from 'bun:test'

import {readAudio, readAudioOverride, readAudioVolume} from '../../src/lib/audio/audioParameter.ts'
import {readIntroNarration} from '../../src/lib/audio/intro.ts'
import {readDevelopmentMode} from '../../src/lib/developmentMode.ts'
import {readFade} from '../../src/lib/fade.ts'
import {readFlying} from '../../src/lib/gallery/flyMode.ts'
import {includesResult, readDownload, readWebhook, readWebhookEndpoint} from '../../src/lib/gallery/fusion/resultSharing.ts'
import readQueryOverrides from '../../src/lib/queryOverrides.ts'
import {readAlbedo} from '../../src/lib/rendering/albedo.ts'
import {getAntiAliasing, readAntiAliasing} from '../../src/lib/rendering/antiAliasing.ts'
import {readFov} from '../../src/lib/rendering/fov.ts'
import {readNear} from '../../src/lib/rendering/near.ts'
import {readRatio} from '../../src/lib/rendering/ratio.ts'
import {readScale, readWarmupScale} from '../../src/lib/rendering/scale.ts'
import {readShowWireframe} from '../../src/lib/rendering/showWireframe.ts'
import {readWireframeHighlight} from '../../src/lib/rendering/wireframeHighlight.ts'
import {readRoomAnnouncements} from '../../src/lib/roomAnnouncements.ts'
import {readDumpScreenshot} from '../../src/lib/telemetry/dumpScreenshot.ts'
import {readTelemetry} from '../../src/lib/telemetry/telemetryParameter.ts'

describe('URL options', () => {
  test('?development is enabled by a bare or true flag only', () => {
    expect(readDevelopmentMode('?development')).toBe(true)
    expect(readDevelopmentMode('?development=true')).toBe(true)
    for (const search of ['', '?development=false', '?development=1', '?development=TRUE', '?dev=true']) {
      expect(readDevelopmentMode(search)).toBe(false)
    }
  })
  test('?telemetry is enabled by a bare or true flag only', () => {
    expect(readTelemetry('?telemetry')).toBe(true)
    expect(readTelemetry('?telemetry=true')).toBe(true)
    expect(readTelemetry('?graphics=fast&telemetry&logs_ingestion_endpoint=https://logs.test/insert/jsonline?_stream_fields=service.name')).toBe(true)
    for (const search of ['', '?telemetry=false', '?telemetry=1', '?telemetry=TRUE']) {
      expect(readTelemetry(search)).toBe(false)
    }
  })
  test('?dump_screenshot is enabled by a bare or true flag only', () => {
    expect(readDumpScreenshot('?dump_screenshot')).toBe(true)
    expect(readDumpScreenshot('?dump_screenshot=true')).toBe(true)
    expect(readDumpScreenshot('?development&dump_screenshot')).toBe(true)
    for (const search of ['', '?development', '?dump_screenshot=false', '?dump_screenshot=1', '?dump_screenshot=TRUE', '?dump_screenshots=true']) {
      expect(readDumpScreenshot(search)).toBe(false)
    }
  })
  test('?download and ?webhook share new fusion results with a bare or true flag and every result with all', () => {
    for (const [key, read] of [['download', readDownload], ['webhook', readWebhook]] as const) {
      expect(read(`?${key}`)).toBe(true)
      expect(read(`?${key}=true`)).toBe(true)
      expect(read(`?${key}=all`)).toBe('all')
      for (const search of ['', `?${key}=false`, `?${key}=1`, `?${key}=ALL`, `?${key}s=all`]) {
        expect(read(search)).toBe(false)
      }
    }
    expect(readWebhook('?download')).toBe(false)
    const making = ['ai', 'collage', 'tint', 'unchanged'] as const
    expect(making.filter(kind => includesResult(kind, false))).toEqual([])
    expect(making.filter(kind => includesResult(kind, true))).toEqual(['ai', 'collage'])
    expect(making.filter(kind => includesResult(kind, 'all'))).toEqual([...making])
  })
  test('?webhook_endpoint takes an HTTP(S) URL or a bare host meaning HTTPS, and only its origin shows among the query overrides', () => {
    expect(readWebhookEndpoint('?webhook_endpoint=http://10.0.0.22:8080/hooks/fusion')).toBe('http://10.0.0.22:8080/hooks/fusion')
    expect(readWebhookEndpoint('?webhook_endpoint=hooks.nas.lan/fusion')).toBe('https://hooks.nas.lan/fusion')
    expect(readWebhookEndpoint(`?webhook_endpoint=${encodeURIComponent('https://hooks.test/fusion?token=secret')}`)).toBe('https://hooks.test/fusion?token=secret')
    for (const search of ['', '?webhook_endpoint', '?webhook_endpoint=', '?webhook_endpoint=ftp://hooks.test/fusion', '?webhook_endpoint=javascript:alert(1)']) {
      expect(readWebhookEndpoint(search)).toBeUndefined()
    }
    expect(readQueryOverrides(`http://localhost/?webhook=all&webhook_endpoint=${encodeURIComponent('https://hooks.test/api/webhooks/1/secret')}`)).toEqual({
      webhook: 'all',
      webhook_endpoint: 'https://hooks.test',
    })
  })
  test('?flying only takes effect with ?development', () => {
    for (const search of ['?development&flying', '?development=true&flying=true', '?flying&development']) {
      expect(readFlying(search)).toBe(true)
    }
    for (const search of ['', '?flying', '?flying=true', '?development', '?development&flying=false', '?development=false&flying']) {
      expect(readFlying(search)).toBe(false)
    }
  })
  test('?near, ?scale and ?warmup_scale accept finite positive numbers', () => {
    for (const [value, expected] of [['0.05', 0.05], ['1', 1], ['1.5', 1.5], ['1e-3', 0.001], ['1e1', 10]] as const) {
      expect(readNear(`?near=${value}`)).toBe(expected)
      expect(readScale(`?scale=${value}`)).toBe(expected)
      expect(readWarmupScale(`?warmup_scale=${value}`)).toBe(expected)
    }
    for (const value of ['', '0', '-0.1', 'auto', 'NaN', 'Infinity']) {
      expect(readNear(`?near=${value}`)).toBeUndefined()
      expect(readScale(`?scale=${value}`)).toBeUndefined()
      expect(readWarmupScale(`?warmup_scale=${value}`)).toBeUndefined()
    }
    expect(readWarmupScale('?scale=2')).toBeUndefined()
  })
  test('?fov accepts degrees above 0 and below 180', () => {
    for (const [value, expected] of [['90', 90], ['62.5', 62.5], ['1e1', 10], ['0.5', 0.5], ['179.9', 179.9]] as const) {
      expect(readFov(`?fov=${value}`)).toBe(expected)
    }
    for (const search of ['', '?fov', '?fov=', '?fov=0', '?fov=-60', '?fov=180', '?fov=270', '?fov=wide', '?fov=NaN', '?fov=Infinity']) {
      expect(readFov(search)).toBeUndefined()
    }
  })
  test('?ratio accepts a positive width-to-height ratio as x:x, x/x or a number', () => {
    for (const [value, expected] of [['16:9', 16 / 9], ['16/9', 16 / 9], ['9:16', 9 / 16], ['19.5:9', 19.5 / 9], ['2.39', 2.39], ['1', 1], ['1e1', 10], ['4%2F3', 4 / 3]] as const) {
      expect(readRatio(`?ratio=${value}`)).toBe(expected)
    }
    for (const search of ['', '?ratio', '?ratio=', '?ratio=0', '?ratio=-1.5', '?ratio=16:0', '?ratio=-16:-9', '?ratio=16:', '?ratio=:9', '?ratio=16:9:1', '?ratio=16x9', '?ratio=wide', '?ratio=Infinity', '?ratio=1e308:1e-308']) {
      expect(readRatio(search)).toBeUndefined()
    }
  })
  test('?wireframe_highlight keeps a slash-separated mesh path', () => {
    expect(readWireframeHighlight('?wireframe_highlight=lobby-fountain')).toBe('lobby-fountain')
    expect(readWireframeHighlight('?wireframe_highlight=/lobby-fountain//fountain-falling-water/')).toBe('lobby-fountain/fountain-falling-water')
    for (const search of ['', '?wireframe_highlight=', '?wireframe_highlight=/']) {
      expect(readWireframeHighlight(search)).toBeUndefined()
    }
  })
  test('?show_wireframe is off unless it is true or a line width in hundredths of a pixel', () => {
    expect(readShowWireframe('?show_wireframe')).toBe(true)
    expect(readShowWireframe('?show_wireframe=true')).toBe(true)
    expect(readShowWireframe('?show_wireframe=1')).toBe(1)
    expect(readShowWireframe('?show_wireframe=50')).toBe(50)
    expect(readShowWireframe('?show_wireframe=250')).toBe(250)
    for (const search of ['', '?show_wireframe=false', '?show_wireframe=0', '?show_wireframe=0.5', '?show_wireframe=-50', '?show_wireframe=thin', '?vision_mode=wireframe']) {
      expect(readShowWireframe(search)).toBe(false)
    }
  })
  test('?albedo is enabled by a bare or true flag only', () => {
    expect(readAlbedo('?albedo')).toBe(true)
    expect(readAlbedo('?albedo=true')).toBe(true)
    for (const search of ['', '?albedo=false', '?albedo=1', '?show_albedo=true']) {
      expect(readAlbedo(search)).toBe(false)
    }
  })
  test('?anti_aliasing accepts traa and false only', () => {
    expect(readAntiAliasing('?anti_aliasing=traa')).toBe('traa')
    expect(readAntiAliasing('?anti_aliasing=false')).toBe(false)
    for (const search of ['', '?anti_aliasing=', '?anti_aliasing=TRAA', '?anti_aliasing=smaa', '?anti_aliasing=true', '?antiAliasing=traa']) {
      expect(readAntiAliasing(search)).toBeUndefined()
    }
  })
  test('the graphics mode decides antialiasing unless the URL overrides it', () => {
    expect(getAntiAliasing(true, undefined)).toBe('traa')
    expect(getAntiAliasing(false, undefined)).toBe(false)
    expect(getAntiAliasing(true, false)).toBe(false)
    expect(getAntiAliasing(false, 'traa')).toBe('traa')
  })
  test('only a bare ?intro_narration, true or 1 plays the welcome narration', () => {
    for (const search of ['https://slop.gallery/?intro_narration', '?intro_narration=true', '?intro_narration=1', '?ai=false&intro_narration=true']) {
      expect(readIntroNarration(search)).toBe(true)
    }
    for (const search of ['', 'https://slop.gallery/', '?intro_narration=false', '?intro_narration=0', '?intro_narration=maybe', '?intro_narration=TRUE']) {
      expect(readIntroNarration(search)).toBe(false)
    }
  })
  test('only ?room_announcements=false or 0 hides the room titles', () => {
    for (const search of ['?room_announcements=false', '?room_announcements=0']) {
      expect(readRoomAnnouncements(search)).toBe(false)
    }
    for (const search of ['', '?room_announcements', '?room_announcements=true', '?room_announcements=maybe']) {
      expect(readRoomAnnouncements(search)).toBe(true)
    }
  })
  test('only ?fade=false or 0 cuts instead of fading', () => {
    for (const search of ['?fade=false', '?fade=0']) {
      expect(readFade(search)).toBe(false)
    }
    for (const search of ['', '?fade', '?fade=true', '?fade=1', '?fade=maybe']) {
      expect(readFade(search)).toBe(true)
    }
  })
  test('?audio is muted unless it is true or a percentage', () => {
    for (const search of ['?audio', '?audio=true']) {
      expect(readAudio(search)).toBe(true)
      expect(readAudioOverride(search)).toBe(true)
      expect(readAudioVolume(search)).toBe(1)
    }
    expect(readAudio('?audio=40')).toBe(40)
    expect(readAudioOverride('?audio=40')).toBe(true)
    expect(readAudioVolume('?audio=40')).toBe(0.4)
    for (const search of ['?audio=false', '?audio=0', '?audio=101', '?audio=0.5', '?audio=loud']) {
      expect(readAudio(search)).toBe(false)
      expect(readAudioOverride(search)).toBe(false)
      expect(readAudioVolume(search)).toBe(1)
    }
    expect(readAudio('')).toBe(false)
    expect(readAudioOverride('')).toBeUndefined()
  })
})
