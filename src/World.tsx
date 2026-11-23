import { SpawnPoint } from '@xrift/world-components'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import { SynthConsole } from './components/Synth/SynthConsole'
import { TranceAudioProvider } from './components/Synth/TranceAudio'
import { TranceStage } from './components/Synth/TranceStage'
import { DancerEnsemble } from './components/Synth/DancerEnsemble'

const ENCLOSURE_COLLIDERS: Array<{
  position: [number, number, number]
  halfExtents: [number, number, number]
}> = [
  { position: [-11.7, 4.45, -4.3], halfExtents: [0.17, 4.5, 12.2] },
  { position: [11.7, 4.45, -4.3], halfExtents: [0.17, 4.5, 12.2] },
  { position: [0, 3.15, -13.35], halfExtents: [12, 5, 0.125] },
  { position: [0, 4.45, 7.65], halfExtents: [11.7, 4.5, 0.17] },
  { position: [0, 8.2, -4.5], halfExtents: [11.7, 0.08, 12] },
]

function EnclosureColliders() {
  return ENCLOSURE_COLLIDERS.map(({ position, halfExtents }, index) => (
    <RigidBody key={index} type="fixed" colliders={false} position={position} restitution={0} friction={0.75}>
      <CuboidCollider args={halfExtents} />
    </RigidBody>
  ))
}

function PerformanceDeck() {
  return (
    <>
      <mesh position={[0, 0.39, -0.52]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.72, 1.22]} />
        <meshStandardMaterial color="#151c15" metalness={0.66} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.81, -0.52]} castShadow receiveShadow>
        <boxGeometry args={[2.82, 0.15, 1.42]} />
        <meshStandardMaterial color="#232c20" metalness={0.74} roughness={0.26} />
      </mesh>
      <mesh position={[0, 0.89, 0.19]}>
        <boxGeometry args={[2.56, 0.018, 0.04]} />
        <meshBasicMaterial color="#68ff70" toneMapped={false} />
      </mesh>
      <mesh position={[-1.34, 0.4, -0.52]}>
        <boxGeometry args={[0.025, 0.72, 1.2]} />
        <meshBasicMaterial color="#45e85d" toneMapped={false} />
      </mesh>
      <mesh position={[1.34, 0.4, -0.52]}>
        <boxGeometry args={[0.025, 0.72, 1.2]} />
        <meshBasicMaterial color="#45e85d" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.19, -0.51]} castShadow>
        <boxGeometry args={[1.7, 0.18, 0.82]} />
        <meshStandardMaterial color="#0a110b" metalness={0.52} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.195, -0.09]}>
        <boxGeometry args={[1.24, 0.018, 0.025]} />
        <meshBasicMaterial color="#55d96a" toneMapped={false} />
      </mesh>
      <Text position={[0, 0.51, 0.103]} fontSize={0.075} color="#b6ffba" anchorX="center" anchorY="middle" material-toneMapped={false}>
        TRANCE SYNTH STATION
      </Text>
    </>
  )
}

function Venue() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.07, -4]} receiveShadow>
        <planeGeometry args={[36, 36]} />
        <meshStandardMaterial color="#030503" roughness={0.92} metalness={0.04} />
      </mesh>
      <RigidBody type="fixed" colliders="cuboid" restitution={0} friction={0.75}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, -4]}>
          <planeGeometry args={[36, 36]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      <EnclosureColliders />

      {[-11.7, 11.7].map((x) => (
        <mesh key={x} position={[x, 4.45, -4.3]}>
          <boxGeometry args={[0.34, 9, 24.4]} />
          <meshBasicMaterial color="#010201" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 8.2, -4.5]}>
        <boxGeometry args={[23.4, 0.16, 24]} />
        <meshBasicMaterial color="#010201" toneMapped={false} />
      </mesh>
      <mesh position={[0, 4.45, 7.65]}>
        <boxGeometry args={[23.4, 9, 0.34]} />
        <meshBasicMaterial color="#010201" toneMapped={false} />
      </mesh>
      {[-9, -6, 6, 9].map((x) => (
        <mesh key={x} position={[x, 8.04, -4.4]}>
          <boxGeometry args={[0.055, 0.035, 23.6]} />
          <meshBasicMaterial color="#58f26c" toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}

export interface WorldProps {
  position?: [number, number, number]
  scale?: number
}

export const World: React.FC<WorldProps> = ({ position = [0, 0, 0], scale = 1 }) => (
  <TranceAudioProvider>
    <group position={position} scale={scale}>
      <color attach="background" args={['#010201']} />
      <Venue />
      <TranceStage />
      <DancerEnsemble />
      <PerformanceDeck />
      <SynthConsole />
      <group position={[0, 0, 1.5]}>
        <SpawnPoint />
      </group>
    </group>
  </TranceAudioProvider>
)
