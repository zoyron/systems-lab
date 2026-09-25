import * as THREE from 'three'
import { mixHexColor, type TimeOfDayPreset } from '../core/config'
import { lerp, seededRandom } from '../core/math'

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
uniform vec3 uGlowColor;
uniform float uGlowStrength;
varying vec3 vDirection;
void main() {
  float elevation = clamp(vDirection.y * 0.5 + 0.5, 0.0, 1.0);
  float upperBlend = smoothstep(0.48, 0.92, elevation);
  float horizonBlend = smoothstep(0.02, 0.46, elevation);
  vec3 color = mix(uLower, uHorizon, horizonBlend);
  color = mix(color, uUpper, smoothstep(0.35, 0.7, elevation));
  color = mix(color, uZenith, upperBlend);
  float duskGlow = pow(1.0 - abs(vDirection.y - 0.06), 8.0);
  color += uGlowColor * duskGlow * uGlowStrength * 0.12;
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export class Sky {
  readonly object: THREE.Group
  readonly moon: THREE.Group
  readonly sun: THREE.Group
  readonly stars: THREE.Points
  readonly clouds: THREE.Group
  readonly scene: THREE.Scene

  private readonly skyMaterial: THREE.ShaderMaterial
  private readonly moonMaterial: THREE.MeshBasicMaterial
  private readonly moonGlowMaterial: THREE.MeshBasicMaterial
  private readonly sunMaterial: THREE.MeshBasicMaterial
  private readonly sunGlowMaterial: THREE.MeshBasicMaterial
  private readonly cloudMaterial: THREE.MeshStandardMaterial
  private readonly starMaterial: THREE.PointsMaterial
  private readonly cloudRecords: CloudRecord[] = []
  private readonly cameraPosition = new THREE.Vector3()

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.object = new THREE.Group()
    this.object.name = 'TimeOfDaySky'
    this.clouds = new THREE.Group()
    this.clouds.name = 'AtmosphericClouds'
    this.object.add(this.clouds)

    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color(0x20143d) },
        uUpper: { value: new THREE.Color(0x3a2457) },
        uHorizon: { value: new THREE.Color(0x856477) },
        uLower: { value: new THREE.Color(0xc18b7b) },
        uGlowColor: { value: new THREE.Color(0xff997e) },
        uGlowStrength: { value: 1 },
      },
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    })
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 20), this.skyMaterial)
    skyDome.name = 'TimeOfDayHorizonGradient'
    skyDome.frustumCulled = false
    skyDome.renderOrder = -1000
    this.object.add(skyDome)

    this.moon = new THREE.Group()
    this.moon.name = 'LargeMoon'
    this.moon.position.set(-2050, 2150, -6100)
    this.moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xf5dfbd,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      fog: false,
    })
    const moonBody = new THREE.Mesh(new THREE.SphereGeometry(178, 20, 12), this.moonMaterial)
    moonBody.name = 'MoonDisc'
    moonBody.renderOrder = -880
    this.moon.add(moonBody)
    this.moonGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xe8c6ae,
      transparent: true,
      opacity: 0.12,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
    const moonGlow = new THREE.Mesh(new THREE.SphereGeometry(255, 16, 10), this.moonGlowMaterial)
    moonGlow.name = 'MoonHalo'
    moonGlow.renderOrder = -885
    this.moon.add(moonGlow)
    this.object.add(this.moon)

    this.sun = new THREE.Group()
    this.sun.name = 'WarmSun'
    this.sun.position.set(-3000, 600, -5200)
    this.sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd7a0,
      transparent: true,
      opacity: 0,
      depthTest: true,
      depthWrite: false,
      fog: false,
    })
    const sunBody = new THREE.Mesh(new THREE.SphereGeometry(132, 20, 12), this.sunMaterial)
    sunBody.name = 'SunDisc'
    sunBody.renderOrder = -880
    this.sun.add(sunBody)
    this.sunGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb56f,
      transparent: true,
      opacity: 0,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
    const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(225, 16, 10), this.sunGlowMaterial)
    sunGlow.name = 'SunHalo'
    sunGlow.renderOrder = -885
    this.sun.add(sunGlow)
    this.object.add(this.sun)

    this.starMaterial = new THREE.PointsMaterial({
      size: 2.8,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      depthTest: false,
      fog: false,
    })
    this.stars = this.createStars(this.starMaterial)
    this.object.add(this.stars)
    this.cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a7894,
      roughness: 1,
      metalness: 0,
      flatShading: true,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      fog: false,
    })
    this.createClouds(this.cloudMaterial)
    scene.add(this.object)
  }

  applyTimeOfDay(from: TimeOfDayPreset, to: TimeOfDayPreset, amount: number): void {
    const mix = (start: number, end: number): number => lerp(start, end, amount)
    const setColor = (color: THREE.Color, start: number, end: number): void => {
      color.setHex(mixHexColor(start, end, amount))
    }
    const setPosition = (
      target: THREE.Vector3,
      start: readonly [number, number, number],
      end: readonly [number, number, number],
    ): void => {
      target.set(mix(start[0], end[0]), mix(start[1], end[1]), mix(start[2], end[2]))
    }

    const setUniformColor = (value: unknown, start: number, end: number): void => {
      if (value instanceof THREE.Color) setColor(value, start, end)
    }
    setUniformColor(this.skyMaterial.uniforms.uZenith?.value, from.skyZenith, to.skyZenith)
    setUniformColor(this.skyMaterial.uniforms.uUpper?.value, from.skyUpper, to.skyUpper)
    setUniformColor(this.skyMaterial.uniforms.uHorizon?.value, from.skyHorizon, to.skyHorizon)
    setUniformColor(this.skyMaterial.uniforms.uLower?.value, from.skyLower, to.skyLower)
    setUniformColor(this.skyMaterial.uniforms.uGlowColor?.value, from.glowColor, to.glowColor)
    const glowStrength = this.skyMaterial.uniforms.uGlowStrength
    if (glowStrength !== undefined) glowStrength.value = mix(from.glowStrength, to.glowStrength)

    setPosition(this.moon.position, from.moonPosition, to.moonPosition)
    setPosition(this.sun.position, from.sunPosition, to.sunPosition)
    setColor(this.moonMaterial.color, from.moonColor, to.moonColor)
    setColor(this.moonGlowMaterial.color, from.moonGlowColor, to.moonGlowColor)
    setColor(this.sunMaterial.color, from.sunColor, to.sunColor)
    setColor(this.sunGlowMaterial.color, from.sunColor, to.sunColor)
    const moonOpacity = mix(from.moonOpacity, to.moonOpacity)
    const sunOpacity = mix(from.sunOpacity, to.sunOpacity)
    this.moonMaterial.opacity = moonOpacity
    this.moonGlowMaterial.opacity = 0.12 * moonOpacity * lerp(1, 1.8, moonOpacity)
    this.sunMaterial.opacity = sunOpacity
    this.sunGlowMaterial.opacity = 0.16 * sunOpacity
    this.moon.visible = moonOpacity > 0.001
    this.sun.visible = sunOpacity > 0.001

    setColor(this.cloudMaterial.color, from.cloudColor, to.cloudColor)
    this.cloudMaterial.opacity = mix(from.cloudOpacity, to.cloudOpacity)
    this.starMaterial.opacity = mix(from.starOpacity, to.starOpacity)
    this.stars.visible = this.starMaterial.opacity > 0.001
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

  private createStars(material: THREE.PointsMaterial): THREE.Points {
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
    const stars = new THREE.Points(geometry, material)
    stars.name = 'SparseStars'
    stars.frustumCulled = false
    stars.renderOrder = -900
    return stars
  }

  private createClouds(cloudMaterial: THREE.MeshStandardMaterial): void {
    const random = seededRandom(90210)
    const cloudGeometry = new THREE.IcosahedronGeometry(1, 1)
    for (let index = 0; index < 15; index += 1) {
      const cloud = new THREE.Group()
      cloud.name = `SkyCloud${index + 1}`
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
