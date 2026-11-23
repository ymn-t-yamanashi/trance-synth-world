import { useEffect, useMemo, useRef } from 'react'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { readAudioLevel, useTranceAudio } from './TranceAudio'

const TRANCE_GREEN = '#62ff63'

function SoftLightAtmosphere() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (!context) return new THREE.CanvasTexture(canvas)
    const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(79,255,89,0.56)')
    gradient.addColorStop(0.24, 'rgba(70,239,83,0.34)')
    gradient.addColorStop(0.62, 'rgba(72,235,91,0.13)')
    gradient.addColorStop(1, 'rgba(50,200,76,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
    const glow = new THREE.CanvasTexture(canvas)
    glow.colorSpace = THREE.SRGBColorSpace
    return glow
  }, [])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <>
      <mesh position={[0, -0.035, -6.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[27, 20]} />
        <meshBasicMaterial map={texture} color={TRANCE_GREEN} transparent opacity={0.24} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.4, -13.12]}>
        <planeGeometry args={[23, 8]} />
        <meshBasicMaterial map={texture} color="#82ff70" transparent opacity={0.19} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </>
  )
}

function StarField() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(420 * 3)
    for (let index = 0; index < 420; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 40
      positions[index * 3 + 1] = Math.random() * 13 + 1
      positions[index * 3 + 2] = -Math.random() * 27 - 1
    }
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return next
  }, [])
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#26743a" size={0.035} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
    </points>
  )
}

function SweepingBeams() {
  const beamRefs = useRef<Array<THREE.Group | null>>([])
  const coneMaterialRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([])
  const spotlightRefs = useRef<Array<THREE.SpotLight | null>>([])
  const targetRefs = useRef<Array<THREE.Object3D | null>>([])
  const pulseRef = useRef(0)
  const lastBeatRef = useRef(0)
  const audio = useTranceAudio()
  const samples = useMemo(() => new Float32Array(256), [])
  const variants = [
    { x: -5.2, z: -9.4, phase: 0 },
    { x: 5.2, z: -9.4, phase: 1.7 },
    { x: -2.7, z: -12, phase: 2.8 },
    { x: 2.7, z: -12, phase: 4.1 },
  ]
  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime
    const level = readAudioLevel(audio.analyser, samples)
    if (audio.beat !== lastBeatRef.current) {
      lastBeatRef.current = audio.beat
      pulseRef.current = audio.playing ? 1 : 0.18
    }
    pulseRef.current = Math.max(0, pulseRef.current - delta * 2.8)
    const pulse = pulseRef.current
    beamRefs.current.forEach((beam, index) => {
      if (!beam) return
      const phase = variants[index].phase
      beam.rotation.z = Math.sin(time * (0.46 + level * 0.3) + phase) * (0.3 + level * 0.22 + pulse * 0.12)
      beam.rotation.x = Math.cos(time * 0.37 + phase) * (0.12 + level * 0.1 + pulse * 0.05)
      const coneMaterial = coneMaterialRefs.current[index]
      if (coneMaterial) coneMaterial.opacity = 0.035 + level * 0.045 + pulse * 0.055
      const spotlight = spotlightRefs.current[index]
      if (spotlight) {
        const target = targetRefs.current[index]
        if (target && spotlight.target !== target) spotlight.target = target
        spotlight.intensity = 55 + level * 62 + pulse * 80
        spotlight.angle = 0.25 + level * 0.055 + pulse * 0.025
      }
    })
  })
  return (
    <>
      {variants.map((beam, index) => (
        <group key={beam.phase} ref={(node) => { beamRefs.current[index] = node }} position={[beam.x, 3.4, beam.z]}>
          <mesh position={[0, 0.025, 4]} rotation={[-0.885, 0, 0]}>
            <cylinderGeometry args={[0.035, 1.45, 10.34, 24, 1, true]} />
            <meshBasicMaterial
              ref={(material) => { coneMaterialRefs.current[index] = material }}
              color={TRANCE_GREEN}
              transparent
              opacity={0.035}
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.NormalBlending}
            />
          </mesh>
          <spotLight
            ref={(light) => { spotlightRefs.current[index] = light }}
            position={[0, 3.3, 0]}
            color={TRANCE_GREEN}
            intensity={55}
            distance={22}
            angle={0.28}
            penumbra={0.86}
            decay={1.6}
            castShadow={false}
            target={targetRefs.current[index] ?? undefined}
          />
          <object3D ref={(target) => { targetRefs.current[index] = target }} position={[0, -3.25, 8]} />
        </group>
      ))}
    </>
  )
}

function LaserFan({ origin, color, phase }: { origin: [number, number, number]; color: string; phase: number }) {
  const lasersRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const from = useMemo(() => new THREE.Vector3(...origin), [origin])
  const to = useMemo(() => new THREE.Vector3(), [])
  const direction = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const audio = useTranceAudio()
  const samples = useMemo(() => new Float32Array(256), [])
  const lastBeatRef = useRef(audio.beat)
  const pulseRef = useRef(0)

  useFrame(({ clock }, delta) => {
    const lasers = lasersRef.current
    if (!lasers) return
    const time = clock.elapsedTime
    const level = readAudioLevel(audio.analyser, samples)
    if (audio.beat !== lastBeatRef.current) {
      lastBeatRef.current = audio.beat
      pulseRef.current = audio.playing ? 1 : 0.18
    }
    pulseRef.current = Math.max(0, pulseRef.current - delta * 3.2)
    const pulse = pulseRef.current
    for (let index = 0; index < lasers.count; index += 1) {
      const spread = (index - (lasers.count - 1) / 2) * (1.9 + level * 1.1 + pulse * 0.8)
      to.set(
        spread + Math.sin(time * (0.38 + level * 0.35) + phase + index * 0.22) * (3.8 + pulse * 1.8),
        0.25 + (index % 3) * 2.1 + Math.sin(time * 0.7 + index) * (0.35 + level * 0.5),
        3.4,
      )
      direction.subVectors(to, from)
      const length = direction.length()
      dummy.position.copy(from).add(to).multiplyScalar(0.5)
      dummy.quaternion.setFromUnitVectors(up, direction.normalize())
      dummy.scale.set(1, length, 1)
      dummy.updateMatrix()
      lasers.setMatrixAt(index, dummy.matrix)
    }
    lasers.instanceMatrix.needsUpdate = true
    const material = lasers.material as THREE.MeshBasicMaterial
    material.opacity = 0.28 + level * 0.48 + pulse * 0.24
  })

  return (
    <instancedMesh ref={lasersRef} args={[undefined, undefined, 7]} frustumCulled={false}>
      <cylinderGeometry args={[0.009, 0.009, 1, 6, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0.72} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  )
}

function PulseStage() {
  const audio = useTranceAudio()
  const ringRef = useRef<THREE.Group>(null)
  const innerScreenRef = useRef<THREE.Mesh>(null)
  const rearScreenRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef(0)
  const lastBeatRef = useRef(audio.beat)

  useFrame((_, delta) => {
    if (audio.beat !== lastBeatRef.current) {
      lastBeatRef.current = audio.beat
      pulseRef.current = audio.playing ? 1 : 0.18
    }
    pulseRef.current = Math.max(0, pulseRef.current - delta * 2.2)
    const pulse = pulseRef.current
    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + pulse * 0.025)
      ringRef.current.rotation.z += delta * 0.025
    }
    const screenMaterial = innerScreenRef.current?.material as THREE.MeshStandardMaterial | undefined
    const rearMaterial = rearScreenRef.current?.material as THREE.MeshStandardMaterial | undefined
    if (screenMaterial) screenMaterial.emissiveIntensity = 1.1 + pulse * 3.5
    if (rearMaterial) rearMaterial.emissiveIntensity = 0.55 + pulse * 0.75
  })

  return (
    <>
      <group position={[0, 4.2, -12.48]} ref={ringRef}>
        <mesh>
          <torusGeometry args={[3.55, 0.12, 16, 144]} />
          <meshStandardMaterial color="#7eff82" emissive="#23e853" emissiveIntensity={2.4} metalness={0.58} roughness={0.23} toneMapped={false} />
        </mesh>
        <mesh>
          <torusGeometry args={[3.23, 0.028, 10, 144]} />
          <meshBasicMaterial color={TRANCE_GREEN} toneMapped={false} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[2.83, 0.018, 8, 128]} />
          <meshBasicMaterial color="#050905" toneMapped={false} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 4]}>
          <torusGeometry args={[2.83, 0.018, 8, 128]} />
          <meshBasicMaterial color="#37df69" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <circleGeometry args={[2.56, 96]} />
          <meshBasicMaterial color="#132719" transparent opacity={0.74} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={innerScreenRef} position={[0, 0, 0.11]}>
          <circleGeometry args={[2.25, 96]} />
          <meshStandardMaterial color="#101d13" emissive="#1b5127" emissiveIntensity={1.1} metalness={0.5} roughness={0.36} side={THREE.DoubleSide} />
        </mesh>
        <Text position={[0, 0.35, 0.24]} fontSize={0.62} color="#a8ffad" anchorX="center" anchorY="middle" material-toneMapped={false} outlineWidth={0.008} outlineColor="#7eff82">
          EUPHORIA
        </Text>
        <Text position={[0, -0.2, 0.24]} fontSize={0.13} color="#c0f6c4" anchorX="center" anchorY="middle" material-toneMapped={false}>
          FREQUENCY OF THE NIGHT
        </Text>
      </group>

      <mesh position={[0, 2.45, -12.65]} ref={rearScreenRef}>
        <boxGeometry args={[12.4, 3.5, 0.38]} />
        <meshStandardMaterial color="#050905" emissive="#123219" emissiveIntensity={0.55} metalness={0.04} roughness={0.92} />
      </mesh>
    </>
  )
}

function StageArchitecture() {
  return (
    <>
      <mesh position={[0, 0.19, -9.3]} castShadow receiveShadow>
        <boxGeometry args={[16, 0.38, 5.1]} />
        <meshStandardMaterial color="#141a13" metalness={0.62} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.397, -7.05]}>
        <boxGeometry args={[15.3, 0.035, 0.045]} />
        <meshBasicMaterial color="#63ff70" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.4, -11.55]}>
        <boxGeometry args={[15.3, 0.035, 0.045]} />
        <meshBasicMaterial color="#63ff70" toneMapped={false} />
      </mesh>
      <mesh position={[0, 4.5, -12.9]}>
        <boxGeometry args={[17, 0.22, 0.42]} />
        <meshBasicMaterial color="#020402" />
      </mesh>
      <mesh position={[0, 4.51, -12.66]}>
        <boxGeometry args={[16.5, 0.045, 0.08]} />
        <meshBasicMaterial color="#94ff70" toneMapped={false} />
      </mesh>
      {[-7.45, 7.45].map((x, side) => (
        <group key={x} position={[x, 1.55, -9.3]}>
          {[0, 1, 2].map((row) => (
            <mesh key={row} position={[0, row * 0.78, 0]} castShadow>
              <boxGeometry args={[1.25 - row * 0.1, 0.72, 0.72]} />
              <meshStandardMaterial color={row === 0 ? '#151b15' : '#1c241b'} metalness={0.34} roughness={0.48} />
            </mesh>
          ))}
          <mesh position={[side === 0 ? 0.635 : -0.635, 0.78, 0]}>
            <boxGeometry args={[0.028, 2.6, 0.8]} />
            <meshBasicMaterial color="#55f26a" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {[-9.1, 9.1].map((x) => (
        <group key={x} position={[x, 3.2, -10.8]}>
          <mesh castShadow>
            <boxGeometry args={[0.32, 6.4, 0.32]} />
            <meshStandardMaterial color="#182017" metalness={0.7} roughness={0.32} />
          </mesh>
          <mesh position={[0, 0, 0.18]}>
            <boxGeometry args={[0.12, 6.1, 0.028]} />
            <meshBasicMaterial color="#61ff68" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 3.15, -13.35]}>
        <boxGeometry args={[24, 10, 0.25]} />
        <meshStandardMaterial color="#030603" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, 6.38, -13.18]}>
        <boxGeometry args={[24, 0.16, 0.5]} />
        <meshStandardMaterial color="#030603" metalness={0.02} roughness={0.96} />
      </mesh>
    </>
  )
}

function FloorDesign() {
  const rings = [2.4, 3.1, 4.05, 5.15, 6.5, 8.2]
  return (
    <>
      {rings.map((radius, index) => (
        <mesh key={radius} position={[0, -0.025 + index * 0.001, -1.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, index < 2 ? 0.018 : 0.009, 8, 128]} />
          <meshBasicMaterial color={index % 2 === 0 ? '#26783c' : '#328147'} transparent opacity={index < 2 ? 0.7 : 0.44} toneMapped={false} />
        </mesh>
      ))}
      {[-6, -3, 0, 3, 6].map((x) => (
        <mesh key={x} position={[x, -0.026, -6.2]}>
          <boxGeometry args={[0.018, 0.009, 7.5]} />
          <meshBasicMaterial color={x === 0 ? '#61ff68' : '#347c42'} transparent opacity={0.48} toneMapped={false} />
        </mesh>
      ))}
      {[-10, -7, 7, 10].map((x) => (
        <mesh key={x} position={[x, 0.05, -5.7]}>
          <boxGeometry args={[0.06, 0.08, 12]} />
          <meshBasicMaterial color="#2d9b45" transparent opacity={0.42} toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}

export function TranceStage() {
  return (
    <>
      <fog attach="fog" args={['#040a06', 20, 43]} />
      <StarField />
      <StageArchitecture />
      <FloorDesign />
      <SoftLightAtmosphere />
      <PulseStage />
      <SweepingBeams />
      <LaserFan origin={[-4.2, 6.1, -10.9]} color={TRANCE_GREEN} phase={0.2} />
      <LaserFan origin={[4.2, 6.1, -10.9]} color={TRANCE_GREEN} phase={2.1} />
      <ambientLight intensity={0.26} color="#62ff70" />
      <hemisphereLight args={['#62ff70', '#173c20', 0.52]} />
      <directionalLight position={[-5, 8, 5]} intensity={0.48} color="#62ff70" />
      <pointLight position={[-7, 4.5, -7]} intensity={34} distance={15} color={TRANCE_GREEN} />
      <pointLight position={[7, 4.5, -7]} intensity={34} distance={15} color={TRANCE_GREEN} />
      <pointLight position={[0, 5.5, -11]} intensity={24} distance={18} color={TRANCE_GREEN} />
      <pointLight position={[-7.8, 1.4, -6.5]} intensity={7} distance={17} color="#6cff75" />
      <pointLight position={[7.8, 1.4, -6.5]} intensity={7} distance={17} color="#6cff75" />
    </>
  )
}
