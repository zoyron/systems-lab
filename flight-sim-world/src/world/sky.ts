import * as THREE from 'three'
import { seededRandom } from '../core/math'

const SKY_RADIUS = 9000

type CloudRecord = {
  object: THREE.Group
  baseX: number
  baseY: number
  baseZ: number
  drift: number
  phase: number
}

const skyVertexShader = `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const skyFragmentShader = `
uniform vec3 uZenith;
uniform vec3 uUpper;
uniform vec3 uHorizon;
uniform vec3 uLower;
varying vec3 vDirection;
void main() {
  float elevation = clamp(vDirection.y * 0.5 + 0.5, 0.0, 1.0);
  float upperBlend = smoothstep(0.48, 0.92, elevation);
  float horizonBlend = smoothstep(0.02, 0.46, elevation);
  vec3 color = mix(uLower, uHorizon, horizonBlend);
  color = mix(color, uUpper, smoothstep(0.35, 0.7, elevation));
  color = mix(color, uZenith, upperBlend);
  float duskGlow = pow(1.0 - abs(vDirection.y - 0.06), 8.0);
  color += vec3(0.12, 0.045, 0.025) * duskGlow;
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export class Sky {
  readonly object: THREE.Group
  readonly moon: THREE.Group
  readonly stars: THREE.Points
  readonly clouds: THREE.Group
  readonly scene: THREE.Scene

  private readonly cloudRecords: CloudRecord[] = []
  private readonly cameraPosition = new THREE.Vector3()

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.object = new THREE.Group()
    this.object.name = 'DuskSky'
    this.clouds = new THREE.Group()
    this.clouds.name = 'AtmosphericClouds'
    this.object.add(this.clouds)

    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color(0x20143d) },
        uUpper: { value: new THREE.Color(0x3a2457) },
        uHorizon: { value: new THREE.Color(0x856477) },
        uLower: { value: new THREE.Color(0xc18b7b) },
      },
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    })
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 20), skyMaterial)
    skyDome.name = 'VioletHorizonGradient'
    skyDome.frustumCulled = false
    skyDome.renderOrder = -1000
    this.object.add(skyDome)

    this.moon = new THREE.Group()
    this.moon.name = 'LargeMoon'
    this.moon.position.set(-2050, 2150, -6100)
    const moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xf5dfbd,
      fog: false,
    })
    const moonBody = new THREE.Mesh(new THREE.SphereGeometry(178, 20, 12), moonMaterial)
    moonBody.name = 'MoonDisc'
    this.moon.add(moonBody)
    const moonGlow = new THREE.Mesh(
      new THREE.SphereGeometry(255, 16, 10),
      new THREE.MeshBasicMaterial({
        color: 0xe8c6ae,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    )
    moonGlow.name = 'MoonHalo'
    this.moon.add(moonGlow)
    this.object.add(this.moon)

    this.stars = this.createStars()
    this.object.add(this.stars)
    this.createClouds()
    scene.add(this.object)
  }

  update(camera: THREE.Camera, time: number): void {
    camera.getWorldPosition(this.cameraPosition)
    this.object.position.copy(this.cameraPosition)
    this.stars.rotation.y = time * 0.0007
    this.stars.rotation.x = Math.sin(time * 0.00013) * 0.008
    this.clouds.rotation.y = time * 0.0014
    for (const record of this.cloudRecords) {
      record.object.position.x = record.baseX + Math.sin(time * record.drift + record.phase) * 75
      record.object.position.y = record.baseY + Math.sin(time * 0.08 + record.phase) * 9
      record.object.position.z = record.baseZ + Math.cos(time * record.drift * 0.7 + record.phase) * 35
    }
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    this.object.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        geometries.add(object.geometry)
        const objectMaterial = object.material
        if (Array.isArray(objectMaterial)) {
          objectMaterial.forEach((material) => materials.add(material))
        } else {
          materials.add(objectMaterial)
        }
      }
    })
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
    this.scene.remove(this.object)
    this.cloudRecords.length = 0
  }

  private createStars(): THREE.Points {
    const random = seededRandom(4217)
    const count = 260
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2
      const elevation = 0.08 + random() * 0.9
      const horizontal = Math.sqrt(Math.max(0, 1 - elevation * elevation))
      const radius = 8200 + random() * 420
      const offset = index * 3
      positions[offset] = Math.cos(angle) * horizontal * radius
      positions[offset + 1] = elevation * radius
      positions[offset + 2] = Math.sin(angle) * horizontal * radius
      const warmth = random()
      colors[offset] = 0.72 + warmth * 0.28
      colors[offset + 1] = 0.72 + warmth * 0.18
      colors[offset + 2] = 0.84 + (1 - warmth) * 0.16
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const material = new THREE.PointsMaterial({
      size: 2.8,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      depthTest: false,
      fog: false,
    })
    const stars = new THREE.Points(geometry, material)
    stars.name = 'SparseStars'
    stars.frustumCulled = false
    stars.renderOrder = -900
    return stars
  }

  private createClouds(): void {
    const random = seededRandom(90210)
    const cloudGeometry = new THREE.IcosahedronGeometry(1, 1)
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a7894,
      roughness: 1,
      metalness: 0,
      flatShading: true,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      fog: false,
    })
    for (let index = 0; index < 15; index += 1) {
      const cloud = new THREE.Group()
      cloud.name = `DuskCloud${index + 1}`
      const pieces = 3 + Math.floor(random() * 3)
      for (let piece = 0; piece < pieces; piece += 1) {
        const mesh = new THREE.Mesh(cloudGeometry, cloudMaterial)
        mesh.position.set(
          (piece - (pieces - 1) * 0.5) * (38 + random() * 24),
          (random() - 0.5) * 18,
          (random() - 0.5) * 26,
        )
        mesh.scale.set(48 + random() * 42, 11 + random() * 13, 24 + random() * 26)
        mesh.rotation.set(random() * 0.4, random() * Math.PI, random() * 0.25)
        cloud.add(mesh)
      }
      const angle = (index / 15) * Math.PI * 2 + random() * 0.45
      const radius = 2600 + random() * 3400
      const baseX = Math.cos(angle) * radius
      const baseZ = Math.sin(angle) * radius
      const baseY = 720 + random() * 620
      cloud.position.set(baseX, baseY, baseZ)
      cloud.userData.baseX = baseX
      cloud.userData.baseY = baseY
      cloud.userData.baseZ = baseZ
      this.clouds.add(cloud)
      this.cloudRecords.push({
        object: cloud,
        baseX,
        baseY,
        baseZ,
        drift: 0.0007 + random() * 0.001,
        phase: random() * Math.PI * 2,
      })
    }
  }
}
