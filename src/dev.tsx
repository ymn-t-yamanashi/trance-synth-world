import { DevEnvironment, XRiftProvider } from '@xrift/world-components'
import type { CameraConfig, PhysicsConfig } from '@xrift/world-components'
import { createRoot } from 'react-dom/client'
import { World } from './World'
import xriftConfig from '../xrift.json'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

const worldConfig = xriftConfig.world as {
  physics?: PhysicsConfig
  camera?: CameraConfig
  outputBufferType?: string
}

createRoot(rootElement).render(
  <XRiftProvider baseUrl="/">
    <DevEnvironment
      physicsConfig={worldConfig.physics}
      camera={worldConfig.camera}
      outputBufferType={worldConfig.outputBufferType}
    >
      <World />
    </DevEnvironment>
  </XRiftProvider>,
)
