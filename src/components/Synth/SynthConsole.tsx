import { useRef } from 'react'
import type { CSSProperties } from 'react'
import { Html, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Interactable } from '@xrift/world-components'
import { getFillPatternLabel, getRhythmPatternLabel, getRootName, readFrequencyBands, useTranceAudio, TRANCE_KEYBOARD_ORDER } from './TranceAudio'

const WHITE_KEYS = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',']
const BLACK_KEYS = ['2', '3', null, '5', '6', '7', null]
const buttonStyle: CSSProperties = {
  border: '1px solid rgba(112, 255, 125, .34)',
  borderRadius: 7,
  background: 'linear-gradient(180deg, rgba(23,54,34,.96), rgba(8,22,14,.98))',
  color: '#dcffdf',
  padding: '7px 10px',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '.06em',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

function WorldButton({
  id,
  label,
  interactionText,
  position,
  active,
  onPress,
}: {
  id: string
  label: string
  interactionText: string
  position: [number, number, number]
  active: boolean
  onPress: () => void
}) {
  return (
    <>
      <Interactable id={id} interactionText={interactionText} onInteract={onPress}>
        <mesh position={position} castShadow receiveShadow>
          <boxGeometry args={[0.38, 0.052, 0.17]} />
          <meshStandardMaterial
            color={active ? '#214c2a' : '#151d18'}
            emissive={active ? '#168b32' : '#070b08'}
            emissiveIntensity={active ? 0.75 : 0.12}
            metalness={0.6}
            roughness={0.28}
          />
        </mesh>
      </Interactable>
      <Text position={[position[0], position[1] + 0.038, position[2] + 0.087]} fontSize={0.018} color={active ? '#e4ffe7' : '#9eb8a2'} anchorX="center" anchorY="middle" material-toneMapped={false}>
        {label}
      </Text>
    </>
  )
}

function VUMeter() {
  const { analyser } = useTranceAudio()
  const barsRef = useRef<Array<THREE.Mesh | null>>([])
  const samplesRef = useRef(new Float32Array(1024))
  const smoothedLevelsRef = useRef(Array.from({ length: 14 }, () => 0))

  useFrame((_, delta) => {
    const levels = readFrequencyBands(analyser, samplesRef.current, barsRef.current.length)
    levels.forEach((target, index) => {
      const previous = smoothedLevelsRef.current[index] ?? 0
      const smoothing = target > previous ? 16 : 4.5
      const level = previous + (target - previous) * Math.min(1, delta * smoothing)
      smoothedLevelsRef.current[index] = level
      const bar = barsRef.current[index]
      if (!bar) return
      const height = 0.008 + level * 0.25
      bar.scale.y = height
      bar.position.y = -0.16 + height / 2
      const material = bar.material as THREE.MeshStandardMaterial
      material.emissiveIntensity = 0.16 + level * 1.9
    })
  })

  const colors = ['#c5ff8a', '#afff78', '#9bff68', '#86fb60', '#70ef56', '#5ee34d', '#4dd446', '#3fc440', '#34b63a', '#2ca534', '#24922e', '#1e8028', '#196d23', '#14591d']

  return (
    <group position={[0.56, 1.39, -0.71]}>
      <mesh>
        <boxGeometry args={[0.16, 0.48, 0.07]} />
        <meshStandardMaterial color="#111b13" metalness={0.56} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.039]}>
        <boxGeometry args={[0.13, 0.43, 0.012]} />
        <meshBasicMaterial color="#07120a" toneMapped={false} />
      </mesh>
      <Text position={[0, 0.19, 0.05]} fontSize={0.024} color="#d8ffda" anchorX="center" anchorY="middle" material-toneMapped={false}>
        VU / Hz
      </Text>
      {colors.map((color, index) => (
        <mesh
          key={index}
          ref={(mesh) => { barsRef.current[index] = mesh }}
          position={[(index - (colors.length - 1) / 2) * 0.0095, -0.156, 0.05]}
        >
          <boxGeometry args={[0.007, 1, 0.012]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.04} toneMapped={false} />
        </mesh>
      ))}
      <Text position={[-0.045, -0.19, 0.05]} fontSize={0.008} color="#a8c9aa" anchorX="center" anchorY="middle" material-toneMapped={false}>55Hz</Text>
      <Text position={[0.045, -0.19, 0.05]} fontSize={0.008} color="#a8c9aa" anchorX="center" anchorY="middle" material-toneMapped={false}>14kHz</Text>
    </group>
  )
}

export function SynthConsole() {
  const audio = useTranceAudio()
  const activeBeat = audio.beat === 0 ? 0 : (audio.beat - 1) % 4

  return (
    <group>
      <mesh position={[0, 1.39, -0.71]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.48, 0.07]} />
        <meshStandardMaterial color="#111b13" metalness={0.56} roughness={0.27} emissive="#071309" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0, 1.39, -0.671]}>
        <boxGeometry args={[0.82, 0.39, 0.012]} />
        <meshBasicMaterial color="#07120a" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.62, -0.662]}>
        <boxGeometry args={[0.68, 0.008, 0.008]} />
        <meshBasicMaterial color="#66ff70" toneMapped={false} />
      </mesh>
      <Text position={[0, 1.56, -0.65]} fontSize={0.055} color="#b5ffb9" anchorX="center" anchorY="middle" material-toneMapped={false}>
        EUPHORIA / TRANCE ENGINE
      </Text>
      <Text position={[0, 1.50, -0.65]} fontSize={0.021} color="#b3f8b7" anchorX="center" anchorY="middle" material-toneMapped={false}>
        {audio.trackSection} · {String(audio.barInTrack).padStart(2, '0')}/64  ·  KEY: {getRootName(audio.rootMidi)} MINOR  ·  {audio.bpm} BPM
      </Text>
      <VUMeter />
      <Html position={[0, 1.35, -0.649]} transform distanceFactor={0.47} zIndexRange={[40, 0]}>
        <div
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            width: 760,
            boxSizing: 'border-box',
            padding: '11px 13px 9px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: 'linear-gradient(135deg, rgba(7,16,10,.97), rgba(12,28,16,.96))',
            border: '1px solid rgba(91,238,109,.46)',
            borderRadius: 10,
            boxShadow: '0 0 28px rgba(48,225,77,.2), inset 0 0 22px rgba(46,120,56,.16)',
            color: '#dcffdf',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <strong style={{ fontSize: 14, letterSpacing: '.16em', color: '#b6ffba' }}>LIVE SYNTH ENGINE</strong>
            <span style={{ fontSize: 10, letterSpacing: '.1em', color: '#a9efaf' }}>{audio.trackSection} · {String(audio.barInTrack).padStart(2, '0')}/64</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, letterSpacing: '.12em', color: audio.audioReady ? '#8fffa0' : '#9ab4a0' }}>
              {audio.audioReady ? 'AUDIO READY · LOCAL' : 'PRESS START TO ENABLE AUDIO'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" style={{ ...buttonStyle, background: audio.playing ? 'linear-gradient(#315b36,#1b3820)' : 'linear-gradient(#247b36,#174c24)' }} onClick={() => audio.playing ? audio.stop() : audio.start()}>
              {audio.playing ? '■ STOP' : '▶ START AUTO'}
            </button>
            <button type="button" style={{ ...buttonStyle, color: audio.drumsEnabled ? '#d9ffdc' : '#84968a' }} onClick={() => audio.setDrumsEnabled(!audio.drumsEnabled)}>
              DRUMS {audio.drumsEnabled ? 'ON' : 'OFF'}
            </button>
            <button type="button" title="Two-bar fills at groove, build and peak phrase boundaries" style={{ ...buttonStyle, color: audio.fillsEnabled ? '#c7ffae' : '#84968a' }} onClick={() => audio.setFillsEnabled(!audio.fillsEnabled)}>
              AUTO FILL {audio.fillsEnabled ? 'ON' : 'OFF'}
            </button>
            <button type="button" style={{ ...buttonStyle, background: 'linear-gradient(#35733a,#1c4826)', color: '#e4ffe1' }} onClick={audio.triggerFill}>
              ✦ FILL NOW · 2 BARS
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 80, fontSize: 11, color: '#a5c9a8', letterSpacing: '.1em' }}>TEMPO</span>
            <button type="button" style={{ ...buttonStyle, padding: '4px 9px' }} onClick={() => audio.setBpm(audio.bpm - 1)}>−</button>
            <strong style={{ width: 45, textAlign: 'center', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{audio.bpm}</strong>
            <button type="button" style={{ ...buttonStyle, padding: '4px 9px' }} onClick={() => audio.setBpm(audio.bpm + 1)}>+</button>
            <div style={{ display: 'flex', gap: 4, marginLeft: 8 }} aria-label={`Beat ${activeBeat + 1}`}>
              {[0, 1, 2, 3].map((beat) => (
                <span key={beat} style={{ width: 13, height: 5, borderRadius: 4, background: activeBeat === beat && audio.playing ? '#7dff77' : '#294232', boxShadow: activeBeat === beat && audio.playing ? '0 0 9px #6eff78' : 'none' }} />
              ))}
            </div>
            <button type="button" style={{ ...buttonStyle, marginLeft: 'auto', background: 'linear-gradient(#356a3a,#203f28)' }} onClick={audio.cycleInstrument}>
              KEYS: {audio.instrument}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 80, fontSize: 11, color: '#a5c9a8', letterSpacing: '.1em' }}>PATTERNS</span>
            <button type="button" style={buttonStyle} onClick={audio.cycleRhythmPattern}>
              RHYTHM: {getRhythmPatternLabel(audio.rhythmPattern)}
            </button>
            <button type="button" style={{ ...buttonStyle, marginLeft: 'auto', background: 'linear-gradient(#35733a,#1c4826)', color: '#e4ffe1' }} onClick={audio.cycleFillPattern}>
              FILL TYPE: {getFillPatternLabel(audio.fillPattern)}
            </button>
          </div>
          <div style={{ borderTop: '1px solid rgba(105,190,119,.24)', paddingTop: 6, display: 'grid', gap: 3, fontSize: 9, color: '#abc1ad' }}>
            <span>鍵盤: Z=C4 · 2=C#4 · X=D4 · 3=D#4 · C=E4 · V=F4 · 5=F#4 · B=G4 · 6=G#4 · N=A4 · 7=A#4 · M=B4 · ,=C5</span>
            <span>キーを押すと音が鳴り、その音が短調の主音に設定されます。SUPERSAW / BASSは押している間伸び、PLUCKは自然に減衰します。WASDで移動。</span>
          </div>
        </div>
      </Html>

      <group position={[0, 0.885, -0.68]}>
        {WHITE_KEYS.map((key, index) => {
          const active = audio.pressedKeys.includes(key)
          const x = (index - 3.5) * 0.073
          return (
            <group key={key} position={[x, 0, 0]}>
              <mesh position={[0, 0.018, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.069, 0.036, 0.29]} />
                <meshStandardMaterial color={active ? '#bcffc0' : '#050705'} emissive={active ? '#42e65b' : '#000000'} emissiveIntensity={active ? 1.5 : 0} roughness={0.27} />
              </mesh>
              <Text position={[0, 0.039, 0.09]} fontSize={0.018} color="#8eff98" anchorX="center" anchorY="middle" material-toneMapped={false}>{key.toUpperCase()}</Text>
            </group>
          )
        })}
        {BLACK_KEYS.map((key, index) => key ? (
          <group key={key} position={[(index - 3) * 0.073, 0.05, -0.055]}>
            <mesh castShadow>
              <boxGeometry args={[0.043, 0.075, 0.18]} />
              <meshStandardMaterial color={audio.pressedKeys.includes(key) ? '#5eff72' : '#111a14'} emissive={audio.pressedKeys.includes(key) ? '#2fe653' : '#000000'} emissiveIntensity={1.4} metalness={0.3} roughness={0.22} />
            </mesh>
            <Text position={[0, 0.04, 0.015]} fontSize={0.016} color="#dcffe0" anchorX="center" anchorY="middle" material-toneMapped={false}>{key}</Text>
          </group>
        ) : null)}
      </group>
      <WorldButton
        id="trance-auto-toggle"
        label={audio.playing ? 'STOP' : 'AUTO'}
        interactionText={audio.playing ? 'Stop the sequencer' : 'Start the trance sequencer'}
        position={[-1.02, 0.916, -0.16]}
        active={audio.playing}
        onPress={() => audio.playing ? audio.stop() : audio.start()}
      />
      <WorldButton
        id="trance-drums-toggle"
        label={audio.drumsEnabled ? 'DRUMS ON' : 'DRUMS OFF'}
        interactionText={audio.drumsEnabled ? 'Mute drums' : 'Enable drums'}
        position={[-0.34, 0.916, -0.16]}
        active={audio.drumsEnabled}
        onPress={() => audio.setDrumsEnabled(!audio.drumsEnabled)}
      />
      <WorldButton
        id="trance-fill-toggle"
        label={audio.fillsEnabled ? 'FILL AUTO' : 'FILL OFF'}
        interactionText={audio.fillsEnabled ? 'Disable automatic two-bar fills' : 'Enable automatic two-bar fills'}
        position={[0.34, 0.916, -0.16]}
        active={audio.fillsEnabled}
        onPress={() => audio.setFillsEnabled(!audio.fillsEnabled)}
      />
      <WorldButton
        id="trance-fill-now"
        label="FILL ×2"
        interactionText="Queue a two-bar drum fill"
        position={[1.02, 0.916, -0.16]}
        active={false}
        onPress={audio.triggerFill}
      />
      <Text position={[0, 0.968, -0.47]} fontSize={0.014} color="#a2c9a7" anchorX="center" anchorY="middle" material-toneMapped={false}>
        PC KEYBED  ·  C4—C5
      </Text>
      <Text position={[0, 0.941, -0.47]} fontSize={0.012} color="#83a988" anchorX="center" anchorY="middle" material-toneMapped={false}>
        {TRANCE_KEYBOARD_ORDER.join('  ')}
      </Text>
    </group>
  )
}
