import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useXRift } from '@xrift/world-components'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { readAudioLevel, useTranceAudio } from './TranceAudio'

const DANCER_COUNT = 10
const DANCER_SCALE = 1.05
const DANCER_BASE_Y = 0.395

const BONE_NAMES = {
  hips: 'J_Bip_C_Hips',
  spine: 'J_Bip_C_Spine',
  chest: 'J_Bip_C_Chest',
  upperChest: 'J_Bip_C_UpperChest',
  neck: 'J_Bip_C_Neck',
  head: 'J_Bip_C_Head',
  leftUpperArm: 'J_Bip_L_UpperArm',
  leftLowerArm: 'J_Bip_L_LowerArm',
  rightUpperArm: 'J_Bip_R_UpperArm',
  rightLowerArm: 'J_Bip_R_LowerArm',
  leftUpperLeg: 'J_Bip_L_UpperLeg',
  leftLowerLeg: 'J_Bip_L_LowerLeg',
  rightUpperLeg: 'J_Bip_R_UpperLeg',
  rightLowerLeg: 'J_Bip_R_LowerLeg',
} as const

type BoneKey = keyof typeof BONE_NAMES
type BoneSet = Partial<Record<BoneKey, THREE.Object3D>>
type RestPose = Partial<Record<BoneKey, THREE.Euler>>
type DancerRig = {
  model: THREE.Object3D
  bones: BoneSet
  rest: RestPose
  column: number
  row: number
  x: number
  z: number
}

type DanceDrive = {
  beat: number
  lastBeatTime: number
  beatProgress: number
  pulse: number
  intensity: number
  level: number
}

function sectionIntensity(section: string, bar: number) {
  if (section === 'INTRO') return Math.min(0.34, 0.13 + Math.max(0, bar - 1) * 0.03)
  if (section === 'GROOVE') return 0.64
  if (section === 'BREAKDOWN') return 0.22
  if (section === 'BUILD') return 0.32 + THREE.MathUtils.clamp((bar - 25) / 7, 0, 1) * 0.55
  if (section === 'PEAK') return 0.94
  if (section === 'OUTRO') return Math.max(0.13, 0.68 - Math.max(0, bar - 49) * 0.075)
  if (section === 'ENDING') return Math.max(0.02, 0.14 - Math.max(0, bar - 57) * 0.017)
  return 0
}

function applyPose(bone: THREE.Object3D | undefined, rest: THREE.Euler | undefined, x = 0, y = 0, z = 0) {
  if (!bone || !rest) return
  bone.rotation.set(rest.x + x, rest.y + y, rest.z + z, rest.order)
}

export function DancerEnsemble() {
  const { baseUrl } = useXRift()
  const { scene } = useGLTF(`${baseUrl}trance-dancer.vrm`)
  const audio = useTranceAudio()
  const rootRefs = useRef<Array<THREE.Group | null>>([])
  const samples = useMemo(() => new Float32Array(256), [])
  const driveRef = useRef<DanceDrive>({
    beat: audio.beat,
    lastBeatTime: 0,
    beatProgress: 0,
    pulse: 0,
    intensity: 0,
    level: 0,
  })

  const rigs = useMemo<DancerRig[]>(() => {
    return Array.from({ length: DANCER_COUNT }, (_, index) => {
      const model = cloneSkinned(scene)
      const bones: BoneSet = {}
      const rest: RestPose = {}
      for (const [key, name] of Object.entries(BONE_NAMES) as Array<[BoneKey, string]>) {
        const bone = model.getObjectByName(name)
        if (!bone) continue
        bones[key] = bone
        rest[key] = bone.rotation.clone()
      }
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = false
          object.receiveShadow = false
          object.frustumCulled = false
        }
      })
      const row = Math.floor(index / 5)
      const column = index % 5
      return {
        model,
        bones,
        rest,
        row,
        column,
        x: (column - 2) * 2.65,
        z: row === 0 ? -7.55 : -10.75,
      }
    })
  }, [scene])

  useFrame(({ clock }, delta) => {
    const drive = driveRef.current
    const elapsed = clock.elapsedTime
    if (audio.beat !== drive.beat) {
      drive.beat = audio.beat
      drive.lastBeatTime = elapsed
      drive.pulse = audio.playing ? 1 : 0
    }
    drive.level = readAudioLevel(audio.analyser, samples)
    drive.pulse = audio.playing ? Math.max(0, drive.pulse - delta * 3.25) : 0
    drive.beatProgress = audio.playing
      ? Math.min(1, Math.max(0, (elapsed - drive.lastBeatTime) / (60 / audio.bpm)))
      : 0
    const targetIntensity = audio.playing ? sectionIntensity(audio.trackSection, audio.barInTrack) : 0
    drive.intensity = THREE.MathUtils.damp(drive.intensity, targetIntensity, audio.playing ? 2.2 : 3.4, delta)

    const beatPosition = drive.beat + drive.beatProgress
    const barPhase = beatPosition * Math.PI * 0.5
    const phrasePhase = beatPosition * Math.PI * 0.25
    const energy = 0.82 + Math.min(0.3, drive.level * 0.5)

    rigs.forEach((rig, index) => {
      const root = rootRefs.current[index]
      if (!root) return
      const phase = rig.column * 0.31 + rig.row * 0.72
      const intensity = Math.min(1.15, drive.intensity * energy)
      const sway = Math.sin(barPhase + phase)
      const step = Math.sin(beatPosition * Math.PI + phase)
      const jumpArc = Math.sin(Math.PI * drive.beatProgress)
      const headbang = Math.sin(beatPosition * Math.PI * 2 + phase * 0.28)
      root.position.set(
        rig.x + sway * 0.075 * intensity,
        DANCER_BASE_Y + (0.34 * jumpArc + 0.03 * drive.pulse) * intensity,
        rig.z,
      )
      root.rotation.set(0, Math.PI + sway * 0.1 * intensity, sway * 0.045 * intensity)

      applyPose(rig.bones.hips, rig.rest.hips, step * 0.09 * intensity, sway * 0.17 * intensity, sway * 0.12 * intensity)
      applyPose(rig.bones.spine, rig.rest.spine, Math.sin(barPhase + phase + 0.8) * 0.09 * intensity, -sway * 0.07 * intensity)
      applyPose(rig.bones.chest, rig.rest.chest, -Math.sin(barPhase + phase + 0.8) * 0.07 * intensity, -sway * 0.13 * intensity)
      applyPose(rig.bones.upperChest, rig.rest.upperChest, 0, sway * 0.045 * intensity)
      applyPose(rig.bones.neck, rig.rest.neck, headbang * 0.42 * intensity - drive.pulse * 0.12 * intensity, sway * 0.06 * intensity, -sway * 0.035 * intensity)
      applyPose(rig.bones.head, rig.rest.head, headbang * 0.68 * intensity - drive.pulse * 0.2 * intensity, sway * 0.1 * intensity, 0)

      const leftReach = Math.max(0, Math.sin(phrasePhase + phase + (rig.column % 2) * Math.PI))
      const rightReach = Math.max(0, Math.sin(phrasePhase + phase + Math.PI + (rig.column % 2) * Math.PI))
      applyPose(rig.bones.leftUpperArm, rig.rest.leftUpperArm, Math.sin(barPhase + phase) * 0.18 * intensity, 0, 1.05 - leftReach * 1.42 * intensity)
      applyPose(rig.bones.rightUpperArm, rig.rest.rightUpperArm, -Math.sin(barPhase + phase) * 0.18 * intensity, 0, -1.05 + rightReach * 1.42 * intensity)
      applyPose(rig.bones.leftLowerArm, rig.rest.leftLowerArm, 0, 0, -0.16 - leftReach * 0.34 * intensity)
      applyPose(rig.bones.rightLowerArm, rig.rest.rightLowerArm, 0, 0, 0.16 + rightReach * 0.34 * intensity)

      applyPose(rig.bones.leftUpperLeg, rig.rest.leftUpperLeg, step * 0.2 * intensity + jumpArc * 0.08 * intensity)
      applyPose(rig.bones.rightUpperLeg, rig.rest.rightUpperLeg, -step * 0.2 * intensity + jumpArc * 0.08 * intensity)
      applyPose(rig.bones.leftLowerLeg, rig.rest.leftLowerLeg, Math.max(0, step) * 0.24 * intensity + jumpArc * 0.14 * intensity)
      applyPose(rig.bones.rightLowerLeg, rig.rest.rightLowerLeg, Math.max(0, -step) * 0.24 * intensity + jumpArc * 0.14 * intensity)
    })
  })

  return (
    <group>
      {rigs.map((rig, index) => (
        <group
          key={index}
          ref={(node) => { rootRefs.current[index] = node }}
          position={[rig.x, DANCER_BASE_Y, rig.z]}
          rotation={[0, Math.PI, 0]}
          scale={DANCER_SCALE}
        >
          <primitive object={rig.model} dispose={null} />
        </group>
      ))}
    </group>
  )
}
