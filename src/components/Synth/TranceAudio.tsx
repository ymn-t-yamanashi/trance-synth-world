import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'

export type SynthInstrument = 'SUPERSAW' | 'PLUCK' | 'BASS'
export type RhythmPattern = 'MELODIC_DRIVE' | 'PEAK_TIME_PUSH' | 'HYPNOTIC_BROKEN'
export type FillPattern = 'SNARE_ACCEL' | 'TOM_DESCENT' | 'HYBRID_IMPACT'

export type TranceAudioState = {
  bpm: number
  setBpm: (value: number) => void
  playing: boolean
  drumsEnabled: boolean
  setDrumsEnabled: (value: boolean) => void
  fillsEnabled: boolean
  setFillsEnabled: (value: boolean) => void
  rhythmPattern: RhythmPattern
  cycleRhythmPattern: () => void
  fillPattern: FillPattern
  cycleFillPattern: () => void
  rootMidi: number
  analyser: AnalyserNode | null
  beat: number
  trackSection: SongSectionName
  barInTrack: number
  instrument: SynthInstrument
  cycleInstrument: () => void
  pressedKeys: string[]
  start: () => void
  stop: () => void
  triggerFill: () => void
  audioReady: boolean
}

type VoiceHandle = {
  gain: GainNode
  oscillators: OscillatorNode[]
  release: number
  released: boolean
}

function trackScheduledSource(source: AudioScheduledSourceNode, registry: { current: AudioScheduledSourceNode[] }) {
  registry.current.push(source)
  source.addEventListener('ended', () => {
    registry.current = registry.current.filter((active) => active !== source)
  }, { once: true })
}

const TranceAudioContext = createContext<TranceAudioState | null>(null)
const KEY_NOTES: Record<string, { note: number; key: string }> = {
  KeyZ: { note: 60, key: 'z' }, Digit2: { note: 61, key: '2' },
  KeyX: { note: 62, key: 'x' }, Digit3: { note: 63, key: '3' },
  KeyC: { note: 64, key: 'c' }, KeyV: { note: 65, key: 'v' },
  Digit5: { note: 66, key: '5' }, KeyB: { note: 67, key: 'b' },
  Digit6: { note: 68, key: '6' }, KeyN: { note: 69, key: 'n' },
  Digit7: { note: 70, key: '7' }, KeyM: { note: 71, key: 'm' },
  Comma: { note: 72, key: ',' },
}
const KEYBOARD_ORDER = ['z', '2', 'x', '3', 'c', 'v', '5', 'b', '6', 'n', '7', 'm', ',']
const CHORD_PROGRESSIONS = [0, -4, -9, -2]
const CHORD_ARPEGGIOS = [
  [0, 3, 7, 10, 12, 15, 19, 22],
  [0, 4, 7, 11, 12, 16, 19, 23],
  [0, 4, 7, 11, 12, 16, 19, 23],
  [0, 4, 7, 10, 12, 16, 19, 22],
]
type HookNote = { step: number; interval: number; velocity: number; gate: number; accent?: boolean }
const MELODIC_HOOKS: HookNote[][] = [
  [
    { step: 0, interval: 4, velocity: 0.78, gate: 1.9, accent: true },
    { step: 3, interval: 2, velocity: 0.55, gate: 1.0 },
    { step: 6, interval: 3, velocity: 0.64, gate: 1.0 },
    { step: 8, interval: 4, velocity: 0.88, gate: 2.0, accent: true },
    { step: 11, interval: 5, velocity: 0.62, gate: 1.1 },
    { step: 14, interval: 3, velocity: 0.72, gate: 1.45 },
  ],
  [
    { step: 1, interval: 5, velocity: 0.6, gate: 1.25 },
    { step: 4, interval: 4, velocity: 0.77, gate: 1.7, accent: true },
    { step: 7, interval: 6, velocity: 0.54, gate: 0.95 },
    { step: 9, interval: 5, velocity: 0.74, gate: 1.25 },
    { step: 12, interval: 3, velocity: 0.65, gate: 1.2, accent: true },
    { step: 15, interval: 2, velocity: 0.69, gate: 1.5 },
  ],
  [
    { step: 0, interval: 4, velocity: 0.8, gate: 1.8, accent: true },
    { step: 2, interval: 6, velocity: 0.52, gate: 0.9 },
    { step: 5, interval: 5, velocity: 0.65, gate: 1.1 },
    { step: 8, interval: 7, velocity: 0.86, gate: 1.7, accent: true },
    { step: 11, interval: 4, velocity: 0.63, gate: 1.0 },
    { step: 14, interval: 2, velocity: 0.72, gate: 1.45 },
  ],
  [
    { step: 1, interval: 5, velocity: 0.59, gate: 1.2 },
    { step: 4, interval: 4, velocity: 0.76, gate: 1.6, accent: true },
    { step: 6, interval: 6, velocity: 0.5, gate: 0.85 },
    { step: 9, interval: 6, velocity: 0.77, gate: 1.2 },
    { step: 12, interval: 5, velocity: 0.72, gate: 1.15, accent: true },
    { step: 15, interval: 7, velocity: 0.84, gate: 1.8 },
  ],
]
const RHYTHMS: Record<RhythmPattern, { label: string; kicks: number[]; claps: number[]; hats: number[]; openHats: number[]; shakers: number[] }> = {
  MELODIC_DRIVE: { label: 'MELODIC DRIVE', kicks: [0, 4, 8, 12], claps: [4, 12], hats: [2, 6, 10, 14], openHats: [14], shakers: [7, 15] },
  PEAK_TIME_PUSH: { label: 'PEAK-TIME PUSH', kicks: [0, 4, 8, 10, 12], claps: [4, 12], hats: [2, 6, 10, 14], openHats: [6, 14], shakers: [3, 7, 11, 15] },
  HYPNOTIC_BROKEN: { label: 'HYPNOTIC BROKEN', kicks: [0, 3, 6, 8, 11, 14], claps: [4, 12], hats: [2, 6, 8, 10, 14], openHats: [14], shakers: [1, 5, 9, 13] },
}
const FILL_PATTERNS: Record<FillPattern, string> = {
  SNARE_ACCEL: '8→16→32→64 SNARE',
  TOM_DESCENT: 'TOM DESCENT',
  HYBRID_IMPACT: 'HYBRID IMPACT',
}
const TRACK_BAR_COUNT = 64
const AUDIO_SCHEDULE_AHEAD_SECONDS = 0.28
const AUDIO_SCHEDULER_INTERVAL_MS = 20
type SongSectionName = 'INTRO' | 'GROOVE' | 'BREAKDOWN' | 'BUILD' | 'PEAK' | 'OUTRO' | 'ENDING'
type TrackArrangement = {
  section: SongSectionName
  barInSection: number
  kickMode: 'NONE' | 'SPARSE' | 'FULL'
  drumLevel: number
  hatLevel: number
  bassLevel: number
  hookMode: 'NONE' | 'SPARSE' | 'ACCENTS' | 'FULL'
  hookLevel: number
  autoFill: boolean
}
const SONG_FORM: Array<{ name: SongSectionName; startBar: number; bars: number }> = [
  { name: 'INTRO', startBar: 0, bars: 8 },
  { name: 'GROOVE', startBar: 8, bars: 8 },
  { name: 'BREAKDOWN', startBar: 16, bars: 8 },
  { name: 'BUILD', startBar: 24, bars: 8 },
  { name: 'PEAK', startBar: 32, bars: 16 },
  { name: 'OUTRO', startBar: 48, bars: 8 },
  { name: 'ENDING', startBar: 56, bars: 8 },
]
function getTrackArrangement(bar: number): TrackArrangement {
  const sectionInfo = SONG_FORM.find(({ startBar, bars }) => bar >= startBar && bar < startBar + bars) ?? SONG_FORM[SONG_FORM.length - 1]
  const barInSection = Math.max(0, bar - sectionInfo.startBar)
  switch (sectionInfo.name) {
    case 'INTRO':
      return {
        section: 'INTRO', barInSection,
        kickMode: barInSection < 4 ? 'NONE' : 'SPARSE',
        drumLevel: barInSection < 4 ? 0.24 : 0.48,
        hatLevel: barInSection < 2 ? 0.3 : 0.48,
        bassLevel: barInSection < 6 ? 0 : 0.24,
        hookMode: barInSection < 4 ? 'SPARSE' : 'ACCENTS',
        hookLevel: barInSection < 4 ? 0.36 : 0.48,
        autoFill: false,
      }
    case 'GROOVE':
      return {
        section: 'GROOVE', barInSection,
        kickMode: 'FULL', drumLevel: 0.86, hatLevel: 0.62,
        bassLevel: 0.72, hookMode: 'FULL', hookLevel: 0.66, autoFill: true,
      }
    case 'BREAKDOWN':
      return {
        section: 'BREAKDOWN', barInSection,
        kickMode: barInSection < 6 ? 'NONE' : 'SPARSE',
        drumLevel: barInSection < 6 ? 0.12 : 0.34,
        hatLevel: barInSection < 4 ? 0.2 : 0.34,
        bassLevel: 0,
        hookMode: barInSection < 4 ? 'ACCENTS' : 'SPARSE',
        hookLevel: barInSection < 4 ? 0.42 : 0.5,
        autoFill: false,
      }
    case 'BUILD':
      return {
        section: 'BUILD', barInSection,
        kickMode: barInSection < 2 ? 'SPARSE' : 'FULL',
        drumLevel: 0.48 + barInSection * 0.065,
        hatLevel: 0.38 + barInSection * 0.075,
        bassLevel: barInSection < 2 ? 0 : 0.28 + barInSection * 0.075,
        hookMode: 'FULL', hookLevel: 0.34 + barInSection * 0.08, autoFill: true,
      }
    case 'PEAK':
      return {
        section: 'PEAK', barInSection,
        kickMode: 'FULL', drumLevel: 1, hatLevel: 0.92,
        bassLevel: 0.95,
        hookMode: barInSection % 8 === 7 ? 'ACCENTS' : 'FULL',
        hookLevel: barInSection % 8 === 7 ? 0.5 : 1,
        autoFill: true,
      }
    case 'OUTRO':
      return {
        section: 'OUTRO', barInSection,
        kickMode: barInSection < 4 ? 'FULL' : barInSection < 6 ? 'SPARSE' : 'NONE',
        drumLevel: barInSection < 4 ? 0.72 : barInSection < 6 ? 0.42 : 0.2,
        hatLevel: barInSection < 4 ? 0.52 : barInSection < 6 ? 0.32 : 0.1,
        bassLevel: barInSection < 4 ? 0.56 : barInSection < 6 ? 0.24 : 0,
        hookMode: barInSection < 4 ? 'ACCENTS' : barInSection < 6 ? 'SPARSE' : 'NONE',
        hookLevel: barInSection < 4 ? 0.44 : barInSection < 6 ? 0.24 : 0,
        autoFill: false,
      }
    case 'ENDING':
      return {
        section: 'ENDING', barInSection,
        kickMode: 'NONE',
        drumLevel: 0.06,
        hatLevel: barInSection < 2 ? 0.1 : barInSection < 4 ? 0.07 : barInSection < 6 ? 0.04 : 0.02,
        bassLevel: 0,
        hookMode: barInSection < 4 ? 'SPARSE' : 'NONE',
        hookLevel: barInSection < 2 ? 0.2 : barInSection < 4 ? 0.12 : 0,
        autoFill: false,
      }
  }
}
function shouldPlayHook(mode: TrackArrangement['hookMode'], hit: HookNote, barInSection: number) {
  if (mode === 'FULL') return true
  if (mode === 'ACCENTS') return Boolean(hit.accent)
  if (mode === 'SPARSE') return Boolean(hit.accent) && barInSection % 2 === 0
  return false
}
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function getRhythmPatternLabel(pattern: RhythmPattern) {
  return RHYTHMS[pattern].label
}

export function getFillPatternLabel(pattern: FillPattern) {
  return FILL_PATTERNS[pattern]
}

export function getRootName(rootMidi: number) {
  return NOTE_NAMES[rootMidi % 12]
}

export function readAudioLevel(analyser: AnalyserNode | null, samples: Float32Array<ArrayBuffer>) {
  if (!analyser) return 0
  analyser.getFloatTimeDomainData(samples)
  let sum = 0
  for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index]
  const rms = Math.sqrt(sum / samples.length)
  const db = 20 * Math.log10(Math.max(rms, 0.00001))
  return Math.min(1, Math.max(0, (db + 48) / 48))
}

export function readFrequencyBands(analyser: AnalyserNode | null, samples: Float32Array<ArrayBuffer>, bandCount = 14) {
  const levels = Array.from({ length: bandCount }, () => 0)
  if (!analyser) return levels

  analyser.getFloatFrequencyData(samples)
  const nyquist = analyser.context.sampleRate / 2
  const binWidth = nyquist / samples.length
  const minFrequency = 55
  const maxFrequency = Math.min(14000, nyquist)
  const range = maxFrequency / minFrequency

  for (let band = 0; band < bandCount; band += 1) {
    const low = minFrequency * range ** (band / bandCount)
    const high = minFrequency * range ** ((band + 1) / bandCount)
    const firstBin = Math.min(samples.length, Math.max(1, Math.ceil(low / binWidth)))
    const lastBin = Math.min(samples.length, Math.ceil(high / binWidth))
    let power = 0
    let count = 0
    for (let bin = firstBin; bin < lastBin; bin += 1) {
      const decibels = samples[bin]
      if (!Number.isFinite(decibels)) continue
      const normalized = Math.min(1, Math.max(0, (decibels - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels)))
      power += normalized * normalized
      count += 1
    }
    levels[band] = count > 0 ? Math.sqrt(power / count) : 0
  }
  return levels
}

function midiToHz(note: number) {
  return 440 * 2 ** ((note - 69) / 12)
}

function makeImpulse(context: AudioContext) {
  const duration = 1.7
  const buffer = context.createBuffer(2, Math.floor(context.sampleRate * duration), context.sampleRate)
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let index = 0; index < data.length; index += 1) {
      const decay = (1 - index / data.length) ** 2.4
      data[index] = (Math.random() * 2 - 1) * decay
    }
  }
  return buffer
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

type GlobalKeyboardHandlers = {
  onKeyDown: (event: KeyboardEvent) => void
  onKeyUp: (event: KeyboardEvent) => void
}

let activeKeyboardHandlers: GlobalKeyboardHandlers | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => activeKeyboardHandlers?.onKeyDown(event), { capture: true, passive: false })
  window.addEventListener('keyup', (event) => activeKeyboardHandlers?.onKeyUp(event), { capture: true, passive: false })
}

export function TranceAudioProvider({ children }: PropsWithChildren) {
  const contextRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const musicBusRef = useRef<GainNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const delayRef = useRef<DelayNode | null>(null)
  const reverbRef = useRef<ConvolverNode | null>(null)
  const noiseBufferRef = useRef<AudioBuffer | null>(null)
  const voicesRef = useRef(new Map<string, VoiceHandle>())
  const scheduledSourcesRef = useRef<AudioScheduledSourceNode[]>([])
  const schedulerRef = useRef<number | null>(null)
  const beatTimerRef = useRef<number | null>(null)
  const endTimerRef = useRef<number | null>(null)
  const sequenceRef = useRef({ nextTime: 0, step: 0, bar: 0 })
  const bpmRef = useRef(138)
  const playingRef = useRef(false)
  const drumsRef = useRef(true)
  const fillsRef = useRef(true)
  const rhythmRef = useRef<RhythmPattern>('MELODIC_DRIVE')
  const fillPatternRef = useRef<FillPattern>('SNARE_ACCEL')
  const rootMidiRef = useRef(66)
  const lastHookMidiRef = useRef(78)
  const manualFillBarsRef = useRef(0)
  const manualFillPendingRef = useRef(false)
  const instrumentRef = useRef<SynthInstrument>('SUPERSAW')
  const heldKeysRef = useRef(new Map<string, VoiceHandle>())

  const [bpm, setBpmState] = useState(138)
  const [playing, setPlaying] = useState(false)
  const [drumsEnabled, setDrumsEnabledState] = useState(true)
  const [fillsEnabled, setFillsEnabledState] = useState(true)
  const [rhythmPattern, setRhythmPattern] = useState<RhythmPattern>('MELODIC_DRIVE')
  const [fillPattern, setFillPattern] = useState<FillPattern>('SNARE_ACCEL')
  const [rootMidi, setRootMidi] = useState(66)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [beat, setBeat] = useState(0)
  const [trackSection, setTrackSection] = useState<SongSectionName>('INTRO')
  const [barInTrack, setBarInTrack] = useState(1)
  const [instrument, setInstrument] = useState<SynthInstrument>('SUPERSAW')
  const [pressedKeys, setPressedKeys] = useState<string[]>([])
  const [audioReady, setAudioReady] = useState(false)

  const ensureAudio = useCallback(() => {
    if (contextRef.current) return contextRef.current

    const context = new AudioContext()
    const master = context.createGain()
    const musicBus = context.createGain()
    const analyserNode = context.createAnalyser()
    const compressor = context.createDynamicsCompressor()
    const delay = context.createDelay(1.25)
    const feedback = context.createGain()
    const delayWet = context.createGain()
    const reverb = context.createConvolver()
    const reverbWet = context.createGain()
    const noise = context.createBuffer(1, context.sampleRate, context.sampleRate)
    const noiseData = noise.getChannelData(0)
    for (let index = 0; index < noiseData.length; index += 1) noiseData[index] = Math.random() * 2 - 1

    master.gain.value = 0.72
    musicBus.gain.value = 0.88
    compressor.threshold.value = -16
    compressor.knee.value = 9
    compressor.ratio.value = 3.2
    compressor.attack.value = 0.004
    compressor.release.value = 0.16
    analyserNode.fftSize = 2048
    analyserNode.smoothingTimeConstant = 0.72
    analyserNode.minDecibels = -90
    analyserNode.maxDecibels = -20
    delay.delayTime.value = 0.34
    feedback.gain.value = 0.27
    delayWet.gain.value = 0.2
    reverbWet.gain.value = 0.13
    reverb.buffer = makeImpulse(context)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(delayWet)
    delayWet.connect(master)
    reverb.connect(reverbWet)
    reverbWet.connect(master)
    musicBus.connect(master)
    master.connect(compressor)
    compressor.connect(analyserNode)
    analyserNode.connect(context.destination)

    contextRef.current = context
    masterRef.current = master
    musicBusRef.current = musicBus
    analyserRef.current = analyserNode
    delayRef.current = delay
    reverbRef.current = reverb
    noiseBufferRef.current = noise
    setAnalyser(analyserNode)
    setAudioReady(true)
    return context
  }, [])

  const startVoice = useCallback((note: number, velocity: number, time: number, type: SynthInstrument, duration?: number) => {
    const context = ensureAudio()
    const master = masterRef.current
    if (!master) return null

    const gain = context.createGain()
    const filter = context.createBiquadFilter()
    const oscillators: OscillatorNode[] = []
    const frequency = midiToHz(note)
    const release = type === 'PLUCK' ? 0.1 : type === 'BASS' ? 0.1 : 0.34
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(type === 'BASS' ? 920 : type === 'PLUCK' ? 1550 : 3600, time)
    if (type === 'PLUCK') {
      filter.frequency.exponentialRampToValueAtTime(6200, time + 0.018)
      filter.frequency.exponentialRampToValueAtTime(1900, time + 0.14)
    }
    filter.Q.setValueAtTime(type === 'BASS' ? 1.4 : 0.75, time)
    gain.gain.setValueAtTime(0.0001, time)
    const peak = Math.max(0.0001, velocity * (type === 'BASS' ? 0.16 : 0.105))
    gain.gain.exponentialRampToValueAtTime(peak, time + (type === 'PLUCK' ? 0.004 : 0.025))

    const oscillatorCount = type === 'SUPERSAW' ? 5 : type === 'PLUCK' ? 2 : 2
    const detunes = type === 'SUPERSAW' ? [-16, -8, 0, 8, 16] : type === 'PLUCK' ? [-3, 3] : [0, 0]
    for (let index = 0; index < oscillatorCount; index += 1) {
      const oscillator = context.createOscillator()
      const voiceGain = context.createGain()
      oscillator.type = type === 'BASS' && index === 1 ? 'triangle' : type === 'PLUCK' && index === 1 ? 'triangle' : 'sawtooth'
      oscillator.frequency.setValueAtTime(type === 'BASS' && index === 1 ? frequency * 0.5 : frequency, time)
      oscillator.detune.setValueAtTime(detunes[index] ?? 0, time)
      voiceGain.gain.value = 1 / oscillatorCount
      oscillator.connect(voiceGain)
      voiceGain.connect(filter)
      oscillator.start(time)
      oscillators.push(oscillator)
    }

    filter.connect(gain)
    gain.connect(musicBusRef.current ?? master)
    const delay = delayRef.current
    const reverb = reverbRef.current
    if (type !== 'BASS' && delay) {
      const send = context.createGain()
      send.gain.value = type === 'SUPERSAW' ? 0.24 : 0.16
      gain.connect(send)
      send.connect(delay)
      send.connect(reverb ?? master)
    }

    const handle: VoiceHandle = { gain, oscillators, release, released: false }
    let cleanupAt: number | null = null
    if (type === 'PLUCK') {
      const naturalDecayEnd = time + 0.095
      gain.gain.exponentialRampToValueAtTime(peak * 0.2, naturalDecayEnd)
      const noteOff = duration === undefined ? time + 0.12 : Math.max(time + duration, naturalDecayEnd)
      const releaseEnd = noteOff + release
      gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd)
      oscillators.forEach((oscillator) => oscillator.stop(releaseEnd + 0.035))
      cleanupAt = releaseEnd + 0.1
    } else if (duration !== undefined) {
      const noteOff = time + duration
      gain.gain.setValueAtTime(peak, Math.max(time + 0.03, noteOff))
      gain.gain.exponentialRampToValueAtTime(0.0001, noteOff + release)
      oscillators.forEach((oscillator) => oscillator.stop(noteOff + release + 0.035))
      cleanupAt = noteOff + release + 0.1
    }
    if (cleanupAt !== null) {
      window.setTimeout(() => {
        gain.disconnect()
        filter.disconnect()
      }, Math.max(0, (cleanupAt - context.currentTime) * 1000))
    }
    return handle
  }, [ensureAudio])

  const releaseVoice = useCallback((handle: VoiceHandle, time?: number) => {
    const context = contextRef.current
    if (!context || handle.released) return
    handle.released = true
    const releaseAt = Math.max(context.currentTime, time ?? context.currentTime)
    handle.gain.gain.cancelAndHoldAtTime(releaseAt)
    handle.gain.gain.exponentialRampToValueAtTime(0.0001, releaseAt + handle.release)
    handle.oscillators.forEach((oscillator) => {
      try { oscillator.stop(releaseAt + handle.release + 0.04) } catch { /* already stopped */ }
    })
    window.setTimeout(() => handle.gain.disconnect(), handle.release * 1000 + 100)
  }, [])

  const scheduleKick = useCallback((time: number, velocity = 1) => {
    const context = contextRef.current
    const master = masterRef.current
    if (!context || !master) return
    const musicBus = musicBusRef.current
    if (musicBus) {
      musicBus.gain.cancelAndHoldAtTime(time)
      musicBus.gain.linearRampToValueAtTime(0.62, time + 0.024)
      musicBus.gain.linearRampToValueAtTime(0.88, time + 0.2)
    }
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(178, time)
    oscillator.frequency.exponentialRampToValueAtTime(43, time + 0.115)
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(0.78 * velocity, time + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.25)
    oscillator.connect(gain)
    gain.connect(master)
    oscillator.start(time)
    oscillator.stop(time + 0.27)
    trackScheduledSource(oscillator, scheduledSourcesRef)

    const noise = noiseBufferRef.current
    if (noise) {
      const click = context.createBufferSource()
      const clickFilter = context.createBiquadFilter()
      const clickGain = context.createGain()
      click.buffer = noise
      clickFilter.type = 'highpass'
      clickFilter.frequency.setValueAtTime(2100, time)
      clickGain.gain.setValueAtTime(0.0001, time)
      clickGain.gain.exponentialRampToValueAtTime(0.075 * velocity, time + 0.001)
      clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.018)
      click.connect(clickFilter)
      clickFilter.connect(clickGain)
      clickGain.connect(master)
      click.start(time)
      click.stop(time + 0.022)
      trackScheduledSource(click, scheduledSourcesRef)
    }
  }, [])

  const scheduleNoiseHit = useCallback((time: number, type: 'hat' | 'open_hat' | 'shaker' | 'fill', velocity = 1) => {
    const context = contextRef.current
    const master = masterRef.current
    const noise = noiseBufferRef.current
    if (!context || !master || !noise) return
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = noise
    filter.type = 'highpass'
    const filterStart = type === 'hat' ? 7600 : type === 'open_hat' ? 6500 : type === 'shaker' ? 9200 : 650
    filter.frequency.setValueAtTime(filterStart, time)
    if (type === 'fill') filter.frequency.exponentialRampToValueAtTime(6800, time + 0.16)
    gain.gain.setValueAtTime(0.0001, time)
    const duration = type === 'hat' ? 0.045 : type === 'open_hat' ? 0.22 : type === 'shaker' ? 0.035 : 0.16
    const peak = type === 'hat' ? 0.055 : type === 'open_hat' ? 0.068 : type === 'shaker' ? 0.032 : 0.22
    gain.gain.exponentialRampToValueAtTime(peak * velocity, time + (type === 'fill' ? 0.11 : 0.0015))
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    source.start(time)
    source.stop(time + duration + 0.01)
    trackScheduledSource(source, scheduledSourcesRef)
  }, [])

  const scheduleClap = useCallback((time: number, velocity = 1) => {
    const context = contextRef.current
    const master = masterRef.current
    const noise = noiseBufferRef.current
    if (!context || !master || !noise) return
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = noise
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1650, time)
    filter.Q.setValueAtTime(0.75, time)
    for (const [offset, hitLevel] of [[0, 0.74], [0.014, 0.58], [0.029, 0.42]] as const) {
      gain.gain.setValueAtTime(0.0001, time + offset)
      gain.gain.exponentialRampToValueAtTime(0.26 * velocity * hitLevel, time + offset + 0.002)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + offset + 0.013)
    }
    gain.gain.setValueAtTime(0.0001, time + 0.046)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    const reverb = reverbRef.current
    if (reverb) {
      const send = context.createGain()
      send.gain.value = 0.19
      gain.connect(send)
      send.connect(reverb)
    }
    source.start(time)
    source.stop(time + 0.16)
    trackScheduledSource(source, scheduledSourcesRef)
  }, [])

  const scheduleSnareTap = useCallback((time: number, velocity = 1) => {
    const context = contextRef.current
    const master = masterRef.current
    const noise = noiseBufferRef.current
    if (!context || !master || !noise) return
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = noise
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1850, time)
    filter.Q.setValueAtTime(0.85, time)
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(0.2 * velocity, time + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.014)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    source.start(time)
    source.stop(time + 0.018)
    trackScheduledSource(source, scheduledSourcesRef)
  }, [])

  const scheduleTom = useCallback((time: number, pitch: number, velocity = 1) => {
    const context = contextRef.current
    const master = masterRef.current
    if (!context || !master) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(pitch, time)
    oscillator.frequency.exponentialRampToValueAtTime(pitch * 0.62, time + 0.12)
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(0.34 * velocity, time + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.19)
    oscillator.connect(gain)
    gain.connect(master)
    oscillator.start(time)
    oscillator.stop(time + 0.2)
    trackScheduledSource(oscillator, scheduledSourcesRef)
  }, [])

  const scheduleStep = useCallback((time: number, step: number, bar: number) => {
    if (step === 0 && manualFillPendingRef.current) {
      manualFillBarsRef.current = 2
      manualFillPendingRef.current = false
    }
    const arrangement = getTrackArrangement(bar)
    if (step === 0) {
      setTrackSection(arrangement.section)
      setBarInTrack(bar + 1)
    }
    const drums = drumsRef.current
    const rhythm = RHYTHMS[rhythmRef.current]
    const kickSteps = arrangement.kickMode === 'FULL' ? rhythm.kicks : arrangement.kickMode === 'SPARSE' ? [0, 8] : []
    const manualFillActive = manualFillBarsRef.current > 0
    const manualFillIndex = manualFillActive ? 2 - manualFillBarsRef.current : -1
    const autoFillIndex = fillsRef.current && arrangement.autoFill && bar % 8 >= 6 ? bar % 8 - 6 : -1
    const fillBarIndex = manualFillActive ? manualFillIndex : autoFillIndex
    const filling = drums && fillBarIndex >= 0
    const fillDrop = filling && fillBarIndex === 1 && step >= 12
    if (drums) {
      if (!fillDrop && kickSteps.includes(step)) scheduleKick(time, (step === 8 ? 0.94 : 1) * arrangement.drumLevel)
      if (!filling && arrangement.kickMode !== 'NONE' && rhythm.claps.includes(step)) {
        scheduleClap(time, (step === 12 ? 1 : 0.88) * arrangement.drumLevel)
      }
      if (rhythm.hats.includes(step)) scheduleNoiseHit(time, 'hat', (fillDrop ? 0.24 : step % 4 === 2 ? 0.72 : 0.44) * arrangement.hatLevel)
      if (rhythm.openHats.includes(step)) scheduleNoiseHit(time, 'open_hat', (fillDrop ? 0.24 : 0.7) * arrangement.hatLevel)
      if (rhythm.shakers.includes(step)) scheduleNoiseHit(time, 'shaker', (fillDrop ? 0.24 : 0.62) * arrangement.hatLevel)

      if (filling) {
        const sixteenth = 60 / bpmRef.current / 4
        const fillMode = fillPatternRef.current
        if (fillMode === 'SNARE_ACCEL') {
          if (fillBarIndex === 0 && step % 2 === 0) {
            scheduleSnareTap(time, 0.38 + (step / 2) * 0.035)
          } else if (fillBarIndex === 1 && step < 8) {
            scheduleSnareTap(time, 0.66 + step * 0.018)
          } else if (fillBarIndex === 1 && step < 12) {
            for (let hit = 0; hit < 2; hit += 1) {
              scheduleSnareTap(time + sixteenth * hit / 2, 0.8 + hit * 0.035)
            }
          } else if (fillBarIndex === 1 && step >= 12) {
            for (let hit = 0; hit < 4; hit += 1) {
              scheduleSnareTap(time + sixteenth * hit / 4, 0.88 + hit * 0.025)
            }
          }
        } else if (fillMode === 'TOM_DESCENT') {
          if (fillBarIndex === 0 && step % 2 === 0) {
            const hit = step / 2
            scheduleTom(time, 330 - hit * 11, 0.5 + hit * 0.04)
          } else if (fillBarIndex === 1 && step < 12) {
            scheduleTom(time, 240 - step * 8, 0.65 + step * 0.02)
          } else if (fillBarIndex === 1 && step >= 12) {
            for (let hit = 0; hit < 2; hit += 1) {
              scheduleTom(time + sixteenth * hit / 2, 140 - (step - 12) * 10 - hit * 7, 0.82 + hit * 0.08)
            }
          }
        } else {
          if (fillBarIndex === 0 && step % 4 === 0) {
            scheduleClap(time, 0.54 + step * 0.018)
          } else if (fillBarIndex === 0 && step % 4 === 2) {
            scheduleTom(time, 270 - step * 8, 0.48 + step * 0.025)
          } else if (fillBarIndex === 1 && step < 8) {
            scheduleNoiseHit(time, 'fill', 0.52 + step * 0.045)
          } else if (fillBarIndex === 1 && step < 12) {
            scheduleSnareTap(time, 0.72 + (step - 8) * 0.04)
          } else if (fillBarIndex === 1 && step >= 12) {
            scheduleTom(time + sixteenth / 2, 136 - (step - 12) * 9, 0.76)
            for (let hit = 0; hit < 2; hit += 1) {
              scheduleSnareTap(time + sixteenth * hit / 2, 0.84 + hit * 0.06)
            }
          }
        }
      }
    }

    const hookIndex = (Math.floor(bar / 4) % 2) * 2 + (bar % 2)
    const hookHit = MELODIC_HOOKS[hookIndex].find((hit) => hit.step === step)
    if (hookHit && !fillDrop && shouldPlayHook(arrangement.hookMode, hookHit, arrangement.barInSection)) {
      const chordIndex = bar % CHORD_PROGRESSIONS.length
      const chordPitch = rootMidiRef.current + CHORD_PROGRESSIONS[chordIndex] + CHORD_ARPEGGIOS[chordIndex][hookHit.interval]
      const candidates = [-24, -12, 0, 12, 24]
        .map((octaves) => chordPitch + octaves)
        .filter((candidate) => candidate >= 72 && candidate <= 88)
      const note = candidates.reduce((nearest, candidate) => (
        Math.abs(candidate - lastHookMidiRef.current) < Math.abs(nearest - lastHookMidiRef.current) ? candidate : nearest
      ), candidates[0] ?? chordPitch)
      lastHookMidiRef.current = note
      const sixteenth = 60 / bpmRef.current / 4
      const duration = sixteenth * hookHit.gate
      startVoice(note, hookHit.velocity * arrangement.hookLevel, time, 'PLUCK', duration)
      if (hookHit.accent && bar % 2 === 0) {
        startVoice(note - 12, 0.18 * arrangement.hookLevel, time, 'SUPERSAW', duration * 1.5)
      }
    }
    if (arrangement.bassLevel > 0 && step % 4 === 2 && !fillDrop && !kickSteps.includes(step)) {
      const chordIndex = bar % CHORD_PROGRESSIONS.length
      const eighthNote = step / 2
      const bassOffsets = [0, 0, 7, 0, 0, 0, 5, -2]
      const bassRoot = rootMidiRef.current - 24 + CHORD_PROGRESSIONS[chordIndex] + bassOffsets[eighthNote]
      startVoice(bassRoot, (eighthNote % 4 === 2 ? 0.76 : 0.66) * arrangement.bassLevel, time, 'BASS', 0.12)
    }
    if (arrangement.section === 'ENDING' && arrangement.barInSection === 6 && step === 0) {
      const tonic = rootMidiRef.current + 12
      const twoBars = 480 / bpmRef.current
      for (const [interval, velocity] of [[0, 0.36], [3, 0.28], [7, 0.31]] as const) {
        startVoice(tonic + interval, velocity, time, 'SUPERSAW', twoBars)
      }
    }
    if (step % 4 === 0) {
      const context = contextRef.current
      const delay = context ? Math.max(0, (time - context.currentTime) * 1000) : 0
      if (beatTimerRef.current !== null) window.clearTimeout(beatTimerRef.current)
      beatTimerRef.current = window.setTimeout(() => {
        beatTimerRef.current = null
        if (playingRef.current) setBeat((value) => value + 1)
      }, delay)
    }
    if (step === 15 && manualFillBarsRef.current > 0) manualFillBarsRef.current -= 1
    if (bar === TRACK_BAR_COUNT - 1 && step === 15) {
      const context = contextRef.current
      const barEnd = time + 60 / bpmRef.current / 4
      const delay = context ? Math.max(0, (barEnd - context.currentTime) * 1000) : 0
      endTimerRef.current = window.setTimeout(() => {
        endTimerRef.current = null
        playingRef.current = false
        setPlaying(false)
        schedulerRef.current = null
        sequenceRef.current = { nextTime: 0, step: 0, bar: 0 }
        manualFillBarsRef.current = 0
        manualFillPendingRef.current = false
        setBeat(0)
        setTrackSection('ENDING')
        setBarInTrack(TRACK_BAR_COUNT)
      }, delay)
    }
  }, [scheduleClap, scheduleKick, scheduleNoiseHit, scheduleSnareTap, scheduleTom, startVoice])

  const setBpm = useCallback((value: number) => {
    const next = Math.round(Math.min(150, Math.max(124, value)))
    bpmRef.current = next
    setBpmState(next)
  }, [])

  const setDrumsEnabled = useCallback((value: boolean) => {
    drumsRef.current = value
    setDrumsEnabledState(value)
  }, [])

  const setFillsEnabled = useCallback((value: boolean) => {
    fillsRef.current = value
    setFillsEnabledState(value)
  }, [])

  const cycleRhythmPattern = useCallback(() => {
    const patterns: RhythmPattern[] = ['MELODIC_DRIVE', 'PEAK_TIME_PUSH', 'HYPNOTIC_BROKEN']
    const next = patterns[(patterns.indexOf(rhythmRef.current) + 1) % patterns.length]
    rhythmRef.current = next
    setRhythmPattern(next)
  }, [])

  const cycleFillPattern = useCallback(() => {
    const patterns: FillPattern[] = ['SNARE_ACCEL', 'TOM_DESCENT', 'HYBRID_IMPACT']
    const next = patterns[(patterns.indexOf(fillPatternRef.current) + 1) % patterns.length]
    fillPatternRef.current = next
    setFillPattern(next)
  }, [])

  const stop = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current)
    schedulerRef.current = null
    if (beatTimerRef.current !== null) window.clearTimeout(beatTimerRef.current)
    beatTimerRef.current = null
    if (endTimerRef.current !== null) window.clearTimeout(endTimerRef.current)
    endTimerRef.current = null
    const context = contextRef.current
    scheduledSourcesRef.current.forEach((source) => {
      try { source.stop(context?.currentTime ?? 0) } catch { /* already ended */ }
    })
    scheduledSourcesRef.current = []
    if (context && musicBusRef.current) {
      musicBusRef.current.gain.cancelScheduledValues(context.currentTime)
      musicBusRef.current.gain.setValueAtTime(0.88, context.currentTime)
    }
    manualFillBarsRef.current = 0
    manualFillPendingRef.current = false
    setTrackSection('INTRO')
    setBarInTrack(1)
    voicesRef.current.forEach((voice) => releaseVoice(voice))
    voicesRef.current.clear()
    heldKeysRef.current.clear()
    setPressedKeys([])
  }, [releaseVoice])

  const start = useCallback(() => {
    const context = ensureAudio()
    void context.resume().catch(() => undefined)
    if (playingRef.current) return
    playingRef.current = true
    setPlaying(true)
    sequenceRef.current = { nextTime: context.currentTime + 0.08, step: 0, bar: 0 }
    setBeat(0)
    setTrackSection('INTRO')
    setBarInTrack(1)
    lastHookMidiRef.current = rootMidiRef.current + 12
    if (endTimerRef.current !== null) window.clearTimeout(endTimerRef.current)
    endTimerRef.current = null
    schedulerRef.current = window.setInterval(() => {
      const activeContext = contextRef.current
      if (!activeContext || !playingRef.current) return
      const sequence = sequenceRef.current
      const stepSeconds = 60 / bpmRef.current / 4
      while (sequence.nextTime < activeContext.currentTime + AUDIO_SCHEDULE_AHEAD_SECONDS && sequence.bar < TRACK_BAR_COUNT) {
        scheduleStep(sequence.nextTime, sequence.step, sequence.bar)
        sequence.nextTime += stepSeconds
        sequence.step += 1
        if (sequence.step >= 16) {
          sequence.step = 0
          sequence.bar += 1
        }
      }
      if (sequence.bar >= TRACK_BAR_COUNT && schedulerRef.current !== null) {
        window.clearInterval(schedulerRef.current)
        schedulerRef.current = null
      }
    }, AUDIO_SCHEDULER_INTERVAL_MS)
  }, [ensureAudio, scheduleStep])

  const triggerFill = useCallback(() => {
    manualFillPendingRef.current = true
    if (!playingRef.current) start()
  }, [start])

  const cycleInstrument = useCallback(() => {
    const instruments: SynthInstrument[] = ['SUPERSAW', 'PLUCK', 'BASS']
    const next = instruments[(instruments.indexOf(instrumentRef.current) + 1) % instruments.length]
    instrumentRef.current = next
    setInstrument(next)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mapping = KEY_NOTES[event.code]
      if (
        !mapping || isEditableTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey || event.isComposing
      ) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.repeat) return
      void ensureAudio().resume().catch(() => undefined)
      const { key, note } = mapping
      const nextRoot = 60 + (note % 12)
      rootMidiRef.current = nextRoot
      setRootMidi(nextRoot)
      if (heldKeysRef.current.has(key)) return
      const voice = startVoice(note, 0.82, contextRef.current?.currentTime ?? 0, instrumentRef.current)
      if (!voice) return
      heldKeysRef.current.set(key, voice)
      voicesRef.current.set(key, voice)
      setPressedKeys((keys) => keys.includes(key) ? keys : [...keys, key])
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const key = KEY_NOTES[event.code]?.key
      if (!key) return
      const voice = heldKeysRef.current.get(key)
      if (!voice) return
      event.preventDefault()
      event.stopImmediatePropagation()
      releaseVoice(voice)
      heldKeysRef.current.delete(key)
      voicesRef.current.delete(key)
      setPressedKeys((keys) => keys.filter((pressed) => pressed !== key))
    }
    const releaseAll = () => {
      heldKeysRef.current.forEach((voice) => releaseVoice(voice))
      heldKeysRef.current.clear()
      voicesRef.current.clear()
      setPressedKeys([])
    }
    const handlers = { onKeyDown, onKeyUp }
    activeKeyboardHandlers = handlers
    window.addEventListener('blur', releaseAll)
    document.addEventListener('visibilitychange', releaseAll)
    return () => {
      if (activeKeyboardHandlers === handlers) activeKeyboardHandlers = null
      window.removeEventListener('blur', releaseAll)
      document.removeEventListener('visibilitychange', releaseAll)
      releaseAll()
    }
  }, [ensureAudio, releaseVoice, startVoice])

  useEffect(() => () => {
    if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current)
    if (beatTimerRef.current !== null) window.clearTimeout(beatTimerRef.current)
    if (endTimerRef.current !== null) window.clearTimeout(endTimerRef.current)
    const context = contextRef.current
    contextRef.current = null
    if (context && context.state !== 'closed') void context.close().catch(() => undefined)
  }, [])

  const value = useMemo<TranceAudioState>(() => ({
    bpm, setBpm, playing, drumsEnabled, setDrumsEnabled, fillsEnabled, setFillsEnabled,
    rhythmPattern, cycleRhythmPattern, fillPattern, cycleFillPattern, rootMidi, analyser,
    beat, trackSection, barInTrack, instrument, cycleInstrument, pressedKeys, start, stop, triggerFill, audioReady,
  }), [bpm, setBpm, playing, drumsEnabled, setDrumsEnabled, fillsEnabled, setFillsEnabled, rhythmPattern, cycleRhythmPattern, fillPattern, cycleFillPattern, rootMidi, analyser, beat, trackSection, barInTrack, instrument, cycleInstrument, pressedKeys, start, stop, triggerFill, audioReady])

  return <TranceAudioContext.Provider value={value}>{children}</TranceAudioContext.Provider>
}

export function useTranceAudio() {
  const value = useContext(TranceAudioContext)
  if (!value) throw new Error('useTranceAudio must be used inside TranceAudioProvider')
  return value
}

export const TRANCE_KEYBOARD_ORDER = KEYBOARD_ORDER
