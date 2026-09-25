import * as THREE from 'three'
import { LANDMARKS, mixHexColor, WORLD } from '../core/config'
import type { LandmarkDefinition, TimeOfDayPreset } from '../core/config'
import {
  distanceToRiver,
  getRegionAt as getHeightfieldRegion,
  getRiverCenterX,
  getSurfaceHeight,
  getTerrainHeight,
  isAirfieldPoint,
  isRunwayPoint,
  isWaterAt,
} from '../core/heightfield'
import { clamp, lerp, seededRandom, smoothstep } from '../core/math'

export type WorldPosition =
  | THREE.Vector3
  | { readonly x: number; readonly y: number; readonly z: number }
  | readonly [number, number, number]

export type VisibleLandmark = LandmarkDefinition

type TreeRecord = {
  x: number
  y: number
  z: number
  scale: number
  rotation: number
  tint: number
}

type LampRecord = {
  x: number
  y: number
  z: number
  height: number
  rotation: number
  color: THREE.Color
}

type CloudRecord = {
  object: THREE.Group
  baseX: number
  baseY: number
  baseZ: number
  phase: number
  drift: number
}

type FarmPalette = {
  field: THREE.Color
  barn: THREE.Color
  roof: THREE.Color
}

type HousePalette = {
  wall: THREE.Color
  roof: THREE.Color
  trim: THREE.Color
}

type LampMaterialRecord = {
  material: THREE.MeshStandardMaterial
  baseIntensity: number
  phase: number
}

type LampLightRecord = {
  light: THREE.PointLight
  baseIntensity: number
  phase: number
}

const positionParts = (position: WorldPosition): [number, number, number] => {
  if (Array.isArray(position)) {
    const tuple = position as readonly [number, number, number]
    return [tuple[0] ?? 0, tuple[1] ?? 0, tuple[2] ?? 0]
  }
  const objectPosition = position as { readonly x: number; readonly y: number; readonly z: number }
  return [objectPosition.x, objectPosition.y, objectPosition.z]
}

const terrainColor = (x: number, z: number, height: number, slope: number): THREE.Color => {
  const color = new THREE.Color()
  if (height < WORLD.waterLevel + 1.5 || isWaterAt(x, z)) {
    color.setHex(0x263d45)
  } else if (isAirfieldPoint(x, z)) {
    color.setHex(0x77705f)
  } else if (height > 145) {
    color.setHex(0x716a7c)
  } else if (height > 82) {
    color.setHex(0x58666b)
  } else if (height > 42) {
    color.setHex(0x536b63)
  } else if (x > 520 && z > -120 && z < 760) {
    color.setHex(0x6e735f)
  } else {
    color.setHex(0x65725d)
  }
  const variation = (Math.sin(x * 0.031 + z * 0.017) + Math.cos(x * 0.013 - z * 0.029)) * 0.018
  color.offsetHSL(0, 0, variation - Math.min(slope * 0.0015, 0.035))
  return color
}

const pushTriangle = (
  positions: number[],
  colors: number[],
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  color: THREE.Color,
): void => {
  positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  for (let index = 0; index < 3; index += 1) {
    colors.push(color.r, color.g, color.b)
  }
}

const createRibbon = (
  points: THREE.Vector3[],
  width: number,
  material: THREE.Material,
  name: string,
): THREE.Mesh => {
  const first = points[0]
  if (!first) {
    throw new Error(`Cannot create ribbon ${name} without points`)
  }
  const positions: number[] = []
  const indices: number[] = []
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index] ?? first
    const previous = points[Math.max(0, index - 1)] ?? first
    const next = points[Math.min(points.length - 1, index + 1)] ?? first
    const tangent = next.clone().sub(previous)
    tangent.y = 0
    if (tangent.lengthSq() < 0.0001) {
      tangent.set(0, 0, 1)
    } else {
      tangent.normalize()
    }
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
    const halfWidth = width * 0.5
    const left = current.clone().addScaledVector(side, halfWidth)
    const right = current.clone().addScaledVector(side, -halfWidth)
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z)
    if (index < points.length - 1) {
      const offset = index * 2
      indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.receiveShadow = true
  return mesh
}

export class World {
  readonly scene: THREE.Scene
  readonly group = new THREE.Group()
  readonly lighting = new THREE.Group()
  readonly landmarkLabels = new Map<string, THREE.Vector3>()
  readonly landmarks = new Map<string, THREE.Object3D>()
  readonly treeMeshes: THREE.InstancedMesh[] = []
  readonly lampMeshes: THREE.InstancedMesh[] = []
  readonly lighthouse = new THREE.Group()
  readonly lighthouseBeam = new THREE.Group()
  readonly lanternRing = new THREE.Group()
  readonly windsock = new THREE.Group()
  readonly cloudLayer = new THREE.Group()
  readonly terrain: THREE.Mesh
  readonly water: THREE.Mesh
  readonly waterMaterial: THREE.ShaderMaterial

  private readonly materials = new Set<THREE.Material>()
  private readonly geometries = new Set<THREE.BufferGeometry>()
  private readonly treeData: TreeRecord[] = []
  private readonly lampData: LampRecord[] = []
  private readonly cloudRecords: CloudRecord[] = []
  private readonly pathSamples: THREE.Vector3[] = []
  private readonly random = seededRandom(73129)
  private readonly lanternLight: THREE.PointLight
  private readonly lanternMaterial: THREE.MeshStandardMaterial
  private readonly worldSkirt: THREE.Mesh
  private hemisphereLight!: THREE.HemisphereLight
  private keyLight!: THREE.DirectionalLight
  private horizonFillLight!: THREE.DirectionalLight
  private sceneFog!: THREE.Fog
  private sceneBackground!: THREE.Color
  private lighthouseBeamMaterial!: THREE.MeshBasicMaterial
  private worldCloudMaterial!: THREE.MeshStandardMaterial
  private lanternRingMaterial!: THREE.MeshStandardMaterial
  private readonly lampMaterialRecords: LampMaterialRecord[] = []
  private readonly lampLightRecords: LampLightRecord[] = []
  private lampFactor = 1

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.group.name = 'WindwardWorld'
    this.lighting.name = 'TimeOfDayLighting'
    this.cloudLayer.name = 'WorldCloudLayer'
    this.group.add(this.lighting, this.cloudLayer)
    this.setupLighting()
    this.addLandmarkAnchors()

    this.terrain = this.createTerrain()
    this.group.add(this.terrain)
    this.waterMaterial = this.createWaterMaterial()
    this.water = this.createWater()
    this.group.add(this.water)
    this.worldSkirt = this.createWorldSkirt()
    this.group.add(this.worldSkirt)

    this.createPaths()
    this.createAirfield()
    this.createBridges()
    this.createFarms()
    this.createTerracesAndRuins()
    this.createVillages()
    this.createMountainPass()
    this.createLighthouse()
    this.lanternMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xffb44e,
        emissive: 0xff6d28,
        emissiveIntensity: 3.2,
        roughness: 0.48,
      }),
    )
    this.lanternLight = new THREE.PointLight(0xff8d3d, 16, 115, 2)
    this.createLanternRing()
    this.createTrees()
    this.createLamps()
    this.createClouds()

    scene.add(this.group)
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

    setColor(this.hemisphereLight.color, from.hemisphereSky, to.hemisphereSky)
    setColor(this.hemisphereLight.groundColor, from.hemisphereGround, to.hemisphereGround)
    this.hemisphereLight.intensity = mix(from.hemisphereIntensity, to.hemisphereIntensity)
    setColor(this.keyLight.color, from.keyColor, to.keyColor)
    this.keyLight.intensity = mix(from.keyIntensity, to.keyIntensity)
    setPosition(this.keyLight.position, from.keyPosition, to.keyPosition)
    setColor(this.horizonFillLight.color, from.fillColor, to.fillColor)
    this.horizonFillLight.intensity = mix(from.fillIntensity, to.fillIntensity)
    setPosition(this.horizonFillLight.position, from.fillPosition, to.fillPosition)
    setColor(this.sceneFog.color, from.fogColor, to.fogColor)
    setColor(this.sceneBackground, from.backgroundColor, to.backgroundColor)
    this.sceneFog.near = mix(from.fogNear, to.fogNear)
    this.sceneFog.far = mix(from.fogFar, to.fogFar)
    const setUniformColor = (value: unknown, start: number, end: number): void => {
      if (value instanceof THREE.Color) setColor(value, start, end)
    }
    setUniformColor(this.waterMaterial.uniforms.uDeepColor?.value, from.waterDeep, to.waterDeep)
    setUniformColor(this.waterMaterial.uniforms.uShallowColor?.value, from.waterShallow, to.waterShallow)
    setUniformColor(this.waterMaterial.uniforms.uFogColor?.value, from.fogColor, to.fogColor)
    const fogNear = this.waterMaterial.uniforms.uFogNear
    const fogFar = this.waterMaterial.uniforms.uFogFar
    if (fogNear !== undefined) fogNear.value = this.sceneFog.near
    if (fogFar !== undefined) fogFar.value = this.sceneFog.far
    this.lampFactor = Math.max(0, mix(from.lampIntensity, to.lampIntensity))
    setColor(this.worldCloudMaterial.color, from.worldCloudColor, to.worldCloudColor)
    this.worldCloudMaterial.opacity = mix(from.worldCloudOpacity, to.worldCloudOpacity)
    this.lanternRingMaterial.emissiveIntensity = 2.4 * this.lampFactor
    for (const record of this.lampMaterialRecords) {
      record.material.emissiveIntensity = record.baseIntensity * this.lampFactor
    }
    for (const record of this.lampLightRecords) {
      record.light.intensity = record.baseIntensity * this.lampFactor
    }
    this.lighthouseBeamMaterial.opacity = 0.14 * this.lampFactor
  }

  update(time: number, cameraPosition: WorldPosition): void {
    const [, cameraHeightValue] = positionParts(cameraPosition)
    const waterTime = this.waterMaterial.uniforms.uTime
    if (waterTime) {
      waterTime.value = time
    }
    this.lighthouseBeam.rotation.y = time * 0.34
    this.lanternRing.rotation.y = time * 0.12
    this.lanternRing.position.y = WORLD.waterLevel + 38 + Math.sin(time * 0.8) * 0.65
    this.lanternMaterial.emissiveIntensity = (2.8 + Math.sin(time * 1.7) * 0.45) * this.lampFactor
    const cameraHeight = clamp(cameraHeightValue / 900, 0, 1)
    this.lanternLight.intensity = (12 + cameraHeight * 7 + Math.sin(time * 1.3) * 1.5) * this.lampFactor
    this.updateLampAnimation(time)

    const sock = this.windsock.userData.sock
    if (sock instanceof THREE.Object3D) {
      sock.rotation.y = Math.sin(time * 0.9) * 0.16
      sock.rotation.z = -Math.PI * 0.5 + Math.sin(time * 1.1) * 0.08
    }
    for (const record of this.cloudRecords) {
      record.object.position.x = record.baseX + Math.sin(time * record.drift + record.phase) * 80
      record.object.position.y = record.baseY + Math.sin(time * 0.07 + record.phase) * 12
      record.object.position.z = record.baseZ + Math.cos(time * record.drift * 0.8 + record.phase) * 32
    }
  }

  getRegionAt(position: WorldPosition): string {
    const [x, y, z] = positionParts(position)
    return getHeightfieldRegion(x, y, z)
  }

  getVisibleLandmarks(position: WorldPosition): VisibleLandmark[] {
    const [x, , z] = positionParts(position)
    return LANDMARKS.filter((landmark) => {
      const dx = x - landmark.position[0]
      const dz = z - landmark.position[2]
      return Math.sqrt(dx * dx + dz * dz) <= landmark.labelRange
    })
  }

  getLandmarkPosition(name: string): THREE.Vector3 | undefined {
    const position = this.landmarkLabels.get(name)
    return position?.clone()
  }

  dispose(): void {
    this.scene.remove(this.group)
    this.geometries.forEach((geometry) => geometry.dispose())
    this.materials.forEach((material) => material.dispose())
    this.geometries.clear()
    this.materials.clear()
    this.landmarkLabels.clear()
    this.landmarks.clear()
  }

  private trackMaterial<T extends THREE.Material>(material: T): T {
    this.materials.add(material)
    return material
  }

  private trackGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.add(geometry)
    return geometry
  }

  private trackLampMaterial<T extends THREE.MeshStandardMaterial>(material: T): T {
    this.trackMaterial(material)
    this.lampMaterialRecords.push({
      material,
      baseIntensity: material.emissiveIntensity,
      phase: this.lampMaterialRecords.length * 0.73,
    })
    return material
  }

  private trackLampLight(light: THREE.PointLight): THREE.PointLight {
    this.lampLightRecords.push({
      light,
      baseIntensity: light.intensity,
      phase: this.lampLightRecords.length * 0.91,
    })
    return light
  }

  private updateLampAnimation(time: number): void {
    for (const record of this.lampMaterialRecords) {
      const pulse = 1 + Math.sin(time * 1.45 + record.phase) * 0.025
      record.material.emissiveIntensity = record.baseIntensity * this.lampFactor * pulse
    }
    for (const record of this.lampLightRecords) {
      const pulse = 1 + Math.sin(time * 1.2 + record.phase) * 0.04
      record.light.intensity = record.baseIntensity * this.lampFactor * pulse
    }
  }

  private addMesh(
    parent: THREE.Object3D,
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: THREE.Vector3,
    castShadow = true,
    receiveShadow = true,
  ): THREE.Mesh {
    this.trackGeometry(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.position.copy(position)
    mesh.castShadow = castShadow
    mesh.receiveShadow = receiveShadow
    parent.add(mesh)
    return mesh
  }

  private addBox(
    parent: THREE.Object3D,
    name: string,
    size: readonly [number, number, number],
    position: THREE.Vector3,
    material: THREE.Material,
    castShadow = true,
    receiveShadow = true,
  ): THREE.Mesh {
    return this.addMesh(
      parent,
      name,
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      material,
      position,
      castShadow,
      receiveShadow,
    )
  }

  private setupLighting(): void {
    this.hemisphereLight = new THREE.HemisphereLight(0x9b8ab4, 0x353642, 1.45)
    this.hemisphereLight.name = 'VioletAmbient'
    this.lighting.add(this.hemisphereLight)

    this.keyLight = new THREE.DirectionalLight(0xc6c4ff, 1.65)
    this.keyLight.name = 'MoonKeyLight'
    this.keyLight.position.set(-820, 1280, -680)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.set(2048, 2048)
    this.keyLight.shadow.radius = 2.5
    this.keyLight.shadow.camera.left = -1850
    this.keyLight.shadow.camera.right = 1850
    this.keyLight.shadow.camera.top = 1850
    this.keyLight.shadow.camera.bottom = -1850
    this.keyLight.shadow.camera.near = 20
    this.keyLight.shadow.camera.far = 3600
    this.keyLight.shadow.bias = -0.00025
    this.keyLight.shadow.normalBias = 0.7
    this.lighting.add(this.keyLight, this.keyLight.target)

    this.horizonFillLight = new THREE.DirectionalLight(0xf0a06d, 0.48)
    this.horizonFillLight.name = 'AmberHorizonFill'
    this.horizonFillLight.position.set(760, 420, -920)
    this.lighting.add(this.horizonFillLight)

    this.sceneFog = new THREE.Fog(0x76617a, 980, 3150)
    this.scene.fog = this.sceneFog
    this.scene.background = new THREE.Color(0x21162f)
    this.sceneBackground = this.scene.background
  }

  private addLandmarkAnchors(): void {
    for (const landmark of LANDMARKS) {
      const anchor = new THREE.Object3D()
      anchor.name = `Landmark:${landmark.name}`
      anchor.position.set(landmark.position[0], landmark.position[1], landmark.position[2])
      anchor.userData.landmark = landmark
      this.landmarks.set(landmark.name, anchor)
      this.landmarkLabels.set(landmark.name, anchor.position.clone())
      this.group.add(anchor)
    }
  }

  private createTerrain(): THREE.Mesh {
    const segments = 192
    const minimum = -WORLD.halfSize - 180
    const maximum = WORLD.halfSize + 180
    const step = (maximum - minimum) / segments
    const positions: number[] = []
    const colors: number[] = []
    for (let zIndex = 0; zIndex < segments; zIndex += 1) {
      const z0 = minimum + zIndex * step
      const z1 = z0 + step
      for (let xIndex = 0; xIndex < segments; xIndex += 1) {
        const x0 = minimum + xIndex * step
        const x1 = x0 + step
        const h00 = getTerrainHeight(x0, z0)
        const h10 = getTerrainHeight(x1, z0)
        const h01 = getTerrainHeight(x0, z1)
        const h11 = getTerrainHeight(x1, z1)
        const centerX = (x0 + x1) * 0.5
        const centerZ = (z0 + z1) * 0.5
        const centerHeight = (h00 + h10 + h01 + h11) * 0.25
        const slope = Math.abs(h10 - h00) + Math.abs(h01 - h00) + Math.abs(h11 - h01)
        const color = terrainColor(centerX, centerZ, centerHeight, slope)
        pushTriangle(
          positions,
          colors,
          [x0, h00, z0],
          [x0, h01, z1],
          [x1, h10, z0],
          color,
        )
        pushTriangle(
          positions,
          colors,
          [x1, h10, z0],
          [x0, h01, z1],
          [x1, h11, z1],
          color,
        )
      }
    }
    const geometry = this.trackGeometry(new THREE.BufferGeometry())
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    const material = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.96,
        metalness: 0,
        flatShading: true,
      }),
    )
    const terrain = new THREE.Mesh(geometry, material)
    terrain.name = 'FacetedHeightfieldTerrain'
    terrain.receiveShadow = true
    return terrain
  }

  private createWorldSkirt(): THREE.Mesh {
    const material = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x252d39, roughness: 1, flatShading: true }),
    )
    const skirt = this.addMesh(
      this.group,
      'WorldSkirt',
      new THREE.BoxGeometry(WORLD.size + 500, 32, WORLD.size + 500),
      material,
      new THREE.Vector3(0, -18, 0),
      false,
      true,
    )
    return skirt
  }

  private createWaterMaterial(): THREE.ShaderMaterial {
    return this.trackMaterial(
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDeepColor: { value: new THREE.Color(0x0b303b) },
          uShallowColor: { value: new THREE.Color(0x17606a) },
          uFogColor: { value: new THREE.Color(0x76617a) },
          uFogNear: { value: 980 },
          uFogFar: { value: 3150 },
        },
        vertexShader: `
          attribute float waterMask;
          uniform float uTime;
          varying float vMask;
          varying vec3 vWorldPosition;
          varying float vWave;
          void main() {
            vec3 transformed = position;
            float broad = sin(position.x * 0.024 + uTime * 0.72) * 0.55;
            float cross = cos(position.z * 0.041 - uTime * 0.54) * 0.32;
            float ripple = sin((position.x + position.z) * 0.085 + uTime * 1.1) * 0.16;
            float wave = broad + cross + ripple;
            transformed.y += wave;
            vWave = wave;
            vMask = waterMask;
            vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uDeepColor;
          uniform vec3 uShallowColor;
          uniform vec3 uFogColor;
          uniform float uFogNear;
          uniform float uFogFar;
          varying float vMask;
          varying vec3 vWorldPosition;
          varying float vWave;
          void main() {
            float edge = smoothstep(0.08, 0.7, vMask);
            if (edge < 0.015) discard;
            float bands = sin(vWorldPosition.x * 0.052 + vWorldPosition.z * 0.018 + uTime * 0.65);
            float glints = pow(max(0.0, bands), 12.0);
            float horizon = pow(1.0 - max(0.0, dot(normalize(cameraPosition - vWorldPosition), vec3(0.0, 1.0, 0.0))), 2.0);
            vec3 color = mix(uDeepColor, uShallowColor, 0.32 + bands * 0.08 + horizon * 0.12);
            color += vec3(0.18, 0.34, 0.32) * glints;
            color += vec3(0.02, 0.05, 0.05) * vWave;
            float distanceToCamera = length(cameraPosition - vWorldPosition);
            float fog = smoothstep(uFogNear, uFogFar, distanceToCamera);
            color = mix(color, uFogColor, fog);
            gl_FragColor = vec4(color, edge * 0.94);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        transparent: true,
        depthWrite: true,
        side: THREE.DoubleSide,
        fog: false,
      }),
    )
  }

  private createWater(): THREE.Mesh {
    const geometry = this.trackGeometry(new THREE.PlaneGeometry(4600, 4600, 156, 156))
    geometry.rotateX(-Math.PI * 0.5)
    const position = geometry.getAttribute('position')
    const masks = new Float32Array(position.count)
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index)
      const z = position.getZ(index)
      const coast = 705 + Math.sin(z * 0.0024) * 64 + Math.sin(z * 0.0067) * 24
      const bayMask = smoothstep(coast - 10, coast + 30, x)
      const riverMask =
        (1 - smoothstep(28, 122, distanceToRiver(x, z))) *
        smoothstep(-1800, -1660, z) *
        (1 - smoothstep(1330, 1510, z))
      let mask = Math.max(bayMask, riverMask)
      if (isWaterAt(x, z)) {
        mask = Math.max(mask, 0.92)
      }
      masks[index] = mask
      position.setY(index, WORLD.waterLevel + 0.04)
    }
    geometry.setAttribute('waterMask', new THREE.BufferAttribute(masks, 1))
    const index = geometry.getIndex()
    if (index !== null) {
      const visibleIndices: number[] = []
      for (let offset = 0; offset < index.count; offset += 3) {
        const first = index.getX(offset)
        const second = index.getX(offset + 1)
        const third = index.getX(offset + 2)
        if (Math.max(masks[first] ?? 0, masks[second] ?? 0, masks[third] ?? 0) >= 0.1) {
          visibleIndices.push(first, second, third)
        }
      }
      geometry.setIndex(visibleIndices)
    }
    geometry.computeBoundingSphere()
    const water = new THREE.Mesh(geometry, this.waterMaterial)
    water.name = 'AnimatedDarkTealWater'
    water.renderOrder = 2
    water.frustumCulled = false
    water.userData.animated = true
    return water
  }

  private createPaths(): void {
    const coastalControls = [
      new THREE.Vector3(-780, 0, 1000),
      new THREE.Vector3(-520, 0, 920),
      new THREE.Vector3(-250, 0, 830),
      new THREE.Vector3(35, 0, 760),
      new THREE.Vector3(320, 0, 690),
      new THREE.Vector3(555, 0, 590),
      new THREE.Vector3(690, 0, 445),
      new THREE.Vector3(745, 0, 250),
      new THREE.Vector3(700, 0, 40),
      new THREE.Vector3(770, 0, -170),
      new THREE.Vector3(810, 0, -390),
      new THREE.Vector3(735, 0, -590),
      new THREE.Vector3(560, 0, -780),
      new THREE.Vector3(300, 0, -850),
      new THREE.Vector3(80, 0, -760),
      new THREE.Vector3(-80, 0, -620),
    ]
    const coastalCurve = new THREE.CatmullRomCurve3(coastalControls, false, 'centripetal', 0.45)
    const coastalPoints = coastalCurve.getPoints(120)
    for (const point of coastalPoints) {
      const coast = 705 + Math.sin(point.z * 0.0024) * 64 + Math.sin(point.z * 0.0067) * 24
      point.x = Math.min(point.x, coast - 24)
      point.y = getSurfaceHeight(point.x, point.z) + 0.65
      this.pathSamples.push(point)
    }
    const pathBorder = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x4b4545, roughness: 1, flatShading: true }),
    )
    const pathSurface = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0xb08a70, roughness: 1, flatShading: true }),
    )
    const coastalBorder = createRibbon(coastalPoints, 13, pathBorder, 'CoastalPathBorder')
    const coastalSurface = createRibbon(coastalPoints, 8, pathSurface, 'WindingCoastalPath')
    coastalSurface.position.y = 0.08
    this.trackGeometry(coastalBorder.geometry)
    this.trackGeometry(coastalSurface.geometry)
    this.group.add(coastalBorder, coastalSurface)

    const valleyControls = [
      new THREE.Vector3(-80, 0, -610),
      new THREE.Vector3(10, 0, -420),
      new THREE.Vector3(72, 0, -180),
      new THREE.Vector3(108, 0, 80),
      new THREE.Vector3(155, 0, 245),
    ]
    const valleyCurve = new THREE.CatmullRomCurve3(valleyControls, false, 'centripetal', 0.4)
    const valleyPoints = valleyCurve.getPoints(52)
    for (const point of valleyPoints) {
      point.y = getSurfaceHeight(point.x, point.z) + 0.48
      this.pathSamples.push(point)
    }
    const valleyPath = createRibbon(valleyPoints, 7, pathSurface, 'VillageValleyPath')
    this.trackGeometry(valleyPath.geometry)
    this.group.add(valleyPath)

    for (let index = 6; index < coastalPoints.length - 4; index += 12) {
      const point = coastalPoints[index]
      if (point) {
        this.addLamp(point.x, point.y, point.z, 5.2, 0xffad55)
      }
    }
    for (let index = 8; index < valleyPoints.length - 4; index += 11) {
      const point = valleyPoints[index]
      if (point) {
        this.addLamp(point.x, point.y, point.z, 4.6, 0xffb45b)
      }
    }
  }

  private createAirfield(): void {
    const airfield = new THREE.Group()
    airfield.name = 'WindwardAirfield'
    const elevation = WORLD.airfield.elevation
    const centerX = WORLD.airfield.centerX
    const centerZ = WORLD.airfield.centerZ
    const runwayMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x292d39, roughness: 0.98, flatShading: true }),
    )
    const concreteMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x6c6a68, roughness: 0.96, flatShading: true }),
    )
    const markingMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0xd4c8ae, roughness: 0.82, flatShading: true }),
    )
    const blueMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x4e6871, roughness: 0.9, flatShading: true }),
    )
    const darkMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x252a32, roughness: 0.86, flatShading: true }),
    )
    const warmMaterial = this.trackLampMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xffb84d,
        emissive: 0xff6d2b,
        emissiveIntensity: 2.2,
        roughness: 0.55,
      }),
    )

    this.addBox(
      airfield,
      'Runway',
      [WORLD.airfield.runwayWidth, 0.7, WORLD.airfield.runwayLength],
      new THREE.Vector3(centerX, elevation + 0.35, centerZ),
      runwayMaterial,
      false,
      true,
    )
    this.addBox(
      airfield,
      'TaxiStrip',
      [8, 0.34, 154],
      new THREE.Vector3(centerX + 64, elevation + 0.32, centerZ + 84),
      concreteMaterial,
      false,
      true,
    )
    this.addBox(
      airfield,
      'TaxiConnector',
      [48, 0.34, 12],
      new THREE.Vector3(centerX + 38, elevation + 0.33, centerZ + 16),
      concreteMaterial,
      false,
      true,
    )
    this.addBox(
      airfield,
      'AirfieldApron',
      [120, 0.42, 100],
      new THREE.Vector3(centerX + 94, elevation + 0.22, centerZ + 126),
      concreteMaterial,
      false,
      true,
    )

    for (let z = -184; z <= 184; z += 30) {
      this.addBox(
        airfield,
        `RunwayCenterMark${z}`,
        [1.8, 0.08, 13],
        new THREE.Vector3(centerX, elevation + 0.76, centerZ + z),
        markingMaterial,
        false,
        true,
      )
    }
    for (const end of [-1, 1]) {
      for (let offset = -14; offset <= 14; offset += 7) {
        this.addBox(
          airfield,
          `RunwayThreshold${end}${offset}`,
          [4, 0.09, 15],
          new THREE.Vector3(centerX + offset, elevation + 0.77, centerZ + end * 193),
          markingMaterial,
          false,
          true,
        )
      }
    }
    for (const side of [-1, 1]) {
      for (let z = -198; z <= 198; z += 18) {
        this.addLamp(
          centerX + side * 23,
          elevation + 0.7,
          centerZ + z,
          0.9,
          0xffa43c,
        )
      }
    }
    for (let index = 0; index < 6; index += 1) {
      const lamp = this.trackLampLight(new THREE.PointLight(0xffa43c, 24, 105, 2))
      lamp.name = `RunwayPointLight${index + 1}`
      lamp.position.set(
        centerX + (index % 2 === 0 ? -23 : 23),
        elevation + 3.1,
        centerZ - 150 + index * 60,
      )
      airfield.add(lamp)
    }

    const hangar = new THREE.Group()
    hangar.name = 'AirfieldHangar'
    hangar.position.set(centerX + 92, elevation, centerZ + 132)
    this.addBox(hangar, 'HangarBody', [84, 28, 70], new THREE.Vector3(0, 14, 0), blueMaterial)
    const roof = this.addMesh(
      hangar,
      'HangarRoof',
      new THREE.ConeGeometry(52, 22, 4),
      darkMaterial,
      new THREE.Vector3(0, 39, 0),
    )
    roof.rotation.y = Math.PI * 0.25
    this.addBox(hangar, 'HangarDoor', [46, 18, 1.2], new THREE.Vector3(0, 9, -35.6), darkMaterial)
    this.addBox(hangar, 'HangarDoorStripe', [2, 18, 1.5], new THREE.Vector3(0, 9, -36.3), markingMaterial)
    this.addBox(hangar, 'HangarSideWindow', [18, 5, 1.2], new THREE.Vector3(27, 17, -35.6), warmMaterial)
    airfield.add(hangar)

    const controlCabin = new THREE.Group()
    controlCabin.name = 'ControlCabin'
    controlCabin.position.set(centerX - 72, elevation, centerZ - 112)
    this.addBox(controlCabin, 'ControlTower', [14, 30, 14], new THREE.Vector3(0, 15, 0), concreteMaterial)
    this.addBox(controlCabin, 'ControlCabinRoom', [25, 10, 22], new THREE.Vector3(0, 34, 0), blueMaterial)
    this.addBox(controlCabin, 'ControlWindow', [21, 5, 1], new THREE.Vector3(0, 35, -11.4), warmMaterial)
    const cabinRoof = this.addMesh(
      controlCabin,
      'ControlCabinRoof',
      new THREE.ConeGeometry(17, 8, 4),
      darkMaterial,
      new THREE.Vector3(0, 43, 0),
    )
    cabinRoof.rotation.y = Math.PI * 0.25
    airfield.add(controlCabin)

    this.windsock.name = 'Windsock'
    this.windsock.position.set(centerX + 28, elevation, centerZ - 164)
    this.addMesh(
      this.windsock,
      'WindsockPole',
      new THREE.CylinderGeometry(0.28, 0.42, 17, 7),
      darkMaterial,
      new THREE.Vector3(0, 8.5, 0),
    )
    const sockPivot = new THREE.Group()
    sockPivot.name = 'WindsockPivot'
    sockPivot.position.set(0, 16, 0)
    const sock = this.addMesh(
      sockPivot,
      'OrangeWindsock',
      new THREE.ConeGeometry(3.1, 13, 8, 1, true),
      this.trackMaterial(
        new THREE.MeshStandardMaterial({ color: 0xe7783e, roughness: 0.82, side: THREE.DoubleSide }),
      ),
      new THREE.Vector3(5.8, 0, 0),
    )
    sock.rotation.z = -Math.PI * 0.5
    this.addMesh(
      sockPivot,
      'WindsockStripe',
      new THREE.CylinderGeometry(3.18, 3.18, 2.2, 8),
      markingMaterial,
      new THREE.Vector3(4.3, 0, 0),
    ).rotation.z = Math.PI * 0.5
    this.windsock.add(sockPivot)
    this.windsock.userData.sock = sock
    airfield.add(this.windsock)

    const crateMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x9b684e, roughness: 0.95, flatShading: true }),
    )
    const cratePositions: readonly [number, number, number][] = [
      [centerX + 48, elevation + 2.2, centerZ + 77],
      [centerX + 60, elevation + 2.2, centerZ + 83],
      [centerX + 51, elevation + 6.1, centerZ + 82],
      [centerX + 117, elevation + 2.1, centerZ + 104],
    ]
    for (const [index, position] of cratePositions.entries()) {
      this.addBox(airfield, `CargoCrate${index + 1}`, [8, 4, 8], new THREE.Vector3(...position), crateMaterial)
    }

    const cart = new THREE.Group()
    cart.name = 'FuelCart'
    cart.position.set(centerX + 126, elevation, centerZ + 82)
    this.addBox(cart, 'FuelCartChassis', [14, 2.4, 7], new THREE.Vector3(0, 3.2, 0), darkMaterial)
    const tank = this.addMesh(
      cart,
      'FuelTank',
      new THREE.CylinderGeometry(3.2, 3.2, 13, 10),
      this.trackMaterial(new THREE.MeshStandardMaterial({ color: 0xc18a4e, roughness: 0.75 })),
      new THREE.Vector3(0, 6.2, 0),
    )
    tank.rotation.z = Math.PI * 0.5
    for (const wheelX of [-5, 5]) {
      for (const wheelZ of [-3.8, 3.8]) {
        const wheel = this.addMesh(
          cart,
          `FuelCartWheel${wheelX}${wheelZ}`,
          new THREE.CylinderGeometry(1.8, 1.8, 1.1, 8),
          darkMaterial,
          new THREE.Vector3(wheelX, 1.8, wheelZ),
        )
        wheel.rotation.x = Math.PI * 0.5
      }
    }
    airfield.add(cart)

    this.group.add(airfield)
  }

  private createBridges(): void {
    const bridgeMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x75665f, roughness: 0.98, flatShading: true }),
    )
    const railMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x3b3b48, roughness: 0.8, metalness: 0.2, flatShading: true }),
    )
    const lampColor = new THREE.Color(0xffb45b)
    for (const [index, z] of WORLD.bridgeZ.entries()) {
      const centerX = getRiverCenterX(z)
      const bridge = new THREE.Group()
      bridge.name = index === 0 ? 'NorthRiverBridge' : 'SouthRiverBridge'
      bridge.position.set(centerX, 9.5, z)
      this.addBox(bridge, 'BridgeDeck', [174, 1.5, 18], new THREE.Vector3(0, 0, 0), bridgeMaterial)
      for (const pierX of [-53, 0, 53]) {
        this.addBox(bridge, 'BridgeStonePier', [9, 12, 13], new THREE.Vector3(pierX, -6, 0), bridgeMaterial)
      }
      for (const side of [-1, 1]) {
        this.addBox(
          bridge,
          'BridgeRail',
          [174, 1, 1.2],
          new THREE.Vector3(0, 5.2, side * 8.2),
          railMaterial,
        )
        for (let x = -80; x <= 80; x += 20) {
          this.addBox(
            bridge,
            'BridgeRailPost',
            [1.2, 5.5, 1.2],
            new THREE.Vector3(x, 2.7, side * 8.2),
            railMaterial,
          )
        }
      }
      this.addLamp(centerX - 77, 9.5, z - 8, 5.2, lampColor)
      this.addLamp(centerX + 77, 9.5, z - 8, 5.2, lampColor)
      this.addLamp(centerX - 77, 9.5, z + 8, 5.2, lampColor)
      this.addLamp(centerX + 77, 9.5, z + 8, 5.2, lampColor)
      this.group.add(bridge)

      for (const side of [-1, 1]) {
        const approachX = centerX + side * 112
        const approachY = getSurfaceHeight(approachX, z) + 0.35
        this.addBox(
          this.group,
          'BridgeApproach',
          [48, 0.55, 14],
          new THREE.Vector3(approachX, approachY, z),
          bridgeMaterial,
          false,
          true,
        )
      }
    }
  }

  private createFarms(): void {
    this.createFarm(470, -340, -0.14, {
      field: new THREE.Color(0x8b8c58),
      barn: new THREE.Color(0x9b4f43),
      roof: new THREE.Color(0x563c4d),
    })
    this.createFarm(620, -120, 0.2, {
      field: new THREE.Color(0x6d8058),
      barn: new THREE.Color(0x8b5544),
      roof: new THREE.Color(0x4d3c4b),
    })
    this.createFarm(-510, -390, 0.1, {
      field: new THREE.Color(0x8a8655),
      barn: new THREE.Color(0xa15b43),
      roof: new THREE.Color(0x5a3c4c),
    })
    this.createClearing(290, -370, 86, 0x70805c)
    this.createClearing(-850, -180, 70, 0x78805b)
  }

  private createFarm(x: number, z: number, rotation: number, palette: FarmPalette): void {
    const baseY = getSurfaceHeight(x, z)
    const farm = new THREE.Group()
    farm.name = 'MeadowFarm'
    farm.position.set(x, baseY, z)
    farm.rotation.y = rotation
    const fieldMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: palette.field, roughness: 1, flatShading: true }),
    )
    const barnMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: palette.barn, roughness: 0.94, flatShading: true }),
    )
    const roofMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.95, flatShading: true }),
    )
    const woodMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x5b4a47, roughness: 1, flatShading: true }),
    )
    this.addBox(farm, 'FarmField', [102, 0.35, 76], new THREE.Vector3(0, 0.18, 0), fieldMaterial, false, true)
    for (let row = -3; row <= 3; row += 1) {
      this.addBox(
        farm,
        'CropRow',
        [82, 0.3, 2.1],
        new THREE.Vector3(0, 0.48, row * 9),
        this.trackMaterial(
          new THREE.MeshStandardMaterial({
            color: row % 2 === 0 ? 0xabb06a : 0x929957,
            roughness: 1,
          }),
        ),
        false,
        true,
      )
    }
    this.addBox(farm, 'BarnBody', [40, 19, 30], new THREE.Vector3(-27, 9.5, 8), barnMaterial)
    const roof = this.addMesh(
      farm,
      'BarnRoof',
      new THREE.ConeGeometry(27, 16, 4),
      roofMaterial,
      new THREE.Vector3(-27, 26, 8),
    )
    roof.rotation.y = Math.PI * 0.25
    this.addBox(farm, 'BarnDoor', [13, 12, 1], new THREE.Vector3(-27, 7, -7.6), woodMaterial)
    this.addBox(farm, 'BarnWindow', [7, 5, 1], new THREE.Vector3(-8, 12, -7.6), this.trackLampMaterial(
      new THREE.MeshStandardMaterial({ color: 0xe3a45b, emissive: 0xb85b2c, emissiveIntensity: 0.8 }),
    ))
    const silo = this.addMesh(
      farm,
      'Silo',
      new THREE.CylinderGeometry(7, 7, 32, 10),
      roofMaterial,
      new THREE.Vector3(28, 16, 14),
    )
    silo.castShadow = true
    this.addMesh(
      farm,
      'SiloCap',
      new THREE.ConeGeometry(8, 7, 10),
      roofMaterial,
      new THREE.Vector3(28, 35, 14),
    )
    for (let post = -45; post <= 45; post += 15) {
      this.addBox(farm, 'FarmFencePost', [1.5, 7, 1.5], new THREE.Vector3(post, 3.5, -36), woodMaterial)
    }
    this.addBox(farm, 'FarmFenceRail', [94, 1, 1], new THREE.Vector3(0, 5.5, -36), woodMaterial)
    this.group.add(farm)
    this.addTreeRecord(x - 62, z - 20, 1.15)
    this.addTreeRecord(x + 66, z + 26, 0.95)
    this.addTreeRecord(x + 52, z - 42, 1.05)
  }

  private createClearing(x: number, z: number, radius: number, color: number): void {
    const clearing = new THREE.Group()
    clearing.name = 'OpenMeadowClearing'
    const baseY = getSurfaceHeight(x, z)
    clearing.position.set(x, baseY, z)
    const material = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }),
    )
    this.addMesh(
      clearing,
      'ClearingFloor',
      new THREE.CylinderGeometry(radius, radius * 1.08, 0.8, 14),
      material,
      new THREE.Vector3(0, 0.35, 0),
      false,
      true,
    )
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2
      this.addTreeRecord(x + Math.cos(angle) * radius * 0.8, z + Math.sin(angle) * radius * 0.8, 0.8 + (index % 3) * 0.12)
    }
    this.group.add(clearing)
  }

  private createTerracesAndRuins(): void {
    const terraceMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x586956, roughness: 1, flatShading: true }),
    )
    const terraceEdgeMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x786c68, roughness: 1, flatShading: true }),
    )
    const terraceSpecs: readonly { x: number; z: number; radius: number }[] = [
      { x: -1210, z: -470, radius: 150 },
      { x: -1290, z: 500, radius: 120 },
      { x: 400, z: -650, radius: 135 },
    ]
    for (const [index, spec] of terraceSpecs.entries()) {
      const terrace = new THREE.Group()
      terrace.name = `ForestTerrace${index + 1}`
      const baseY = getSurfaceHeight(spec.x, spec.z)
      terrace.position.set(spec.x, baseY, spec.z)
      for (let level = 0; level < 3; level += 1) {
        const radius = spec.radius - level * 22
        const platform = this.addMesh(
          terrace,
          'TerracePlatform',
          new THREE.CylinderGeometry(radius, radius + 9, 5, 12),
          level === 1 ? terraceEdgeMaterial : terraceMaterial,
          new THREE.Vector3(level * 4, 2.5 + level * 5, level * -3),
          false,
          true,
        )
        platform.rotation.y = level * 0.18
      }
      for (let tree = 0; tree < 16; tree += 1) {
        const angle = (tree / 16) * Math.PI * 2 + index
        const radius = 48 + (tree % 4) * 15
        this.addTreeRecord(spec.x + Math.cos(angle) * radius, spec.z + Math.sin(angle) * radius, 0.85 + (tree % 3) * 0.12)
      }
      this.group.add(terrace)
    }

    const ruin = new THREE.Group()
    ruin.name = 'RuinedStoneCircle'
    const ruinX = -660
    const ruinZ = -430
    const ruinY = getSurfaceHeight(ruinX, ruinZ)
    ruin.position.set(ruinX, ruinY, ruinZ)
    const stoneMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x77727b, roughness: 1, flatShading: true }),
    )
    const darkStoneMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x4d5260, roughness: 1, flatShading: true }),
    )
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2
      const stone = this.addMesh(
        ruin,
        'StandingStone',
        new THREE.DodecahedronGeometry(7, 0),
        index % 3 === 0 ? darkStoneMaterial : stoneMaterial,
        new THREE.Vector3(Math.cos(angle) * 47, 7 + (index % 2) * 2, Math.sin(angle) * 47),
      )
      stone.scale.set(0.72 + (index % 3) * 0.12, 1.1 + (index % 4) * 0.16, 0.7)
      stone.rotation.y = angle
    }
    this.addBox(ruin, 'AltarStone', [15, 8, 15], new THREE.Vector3(0, 4, 0), darkStoneMaterial)
    const fallenArch = this.addBox(ruin, 'FallenArch', [38, 5, 7], new THREE.Vector3(0, 8, -49), stoneMaterial)
    fallenArch.rotation.z = 0.18
    this.group.add(ruin)
  }

  private createVillages(): void {
    const windowMaterial = this.trackLampMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xffc46c,
        emissive: 0xff7d32,
        emissiveIntensity: 2.4,
        roughness: 0.5,
      }),
    )
    const trimMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x4a3b45, roughness: 0.9, flatShading: true }),
    )
    const clockMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0xe2c99c, roughness: 0.8, flatShading: true }),
    )
    const palettes: readonly HousePalette[] = [
      { wall: new THREE.Color(0xb78267), roof: new THREE.Color(0x523d55), trim: new THREE.Color(0x3b3543) },
      { wall: new THREE.Color(0x879477), roof: new THREE.Color(0x4a4255), trim: new THREE.Color(0x343541) },
    ]
    const houseOffsets: readonly (readonly [number, number, number])[] = [
      [-72, -34, 0.95],
      [-28, -52, 0.85],
      [24, -40, 1.05],
      [67, -15, 0.9],
      [62, 38, 1],
      [18, 55, 0.9],
      [-35, 48, 1.05],
      [-76, 20, 0.82],
    ]
    for (const [villageIndex, village] of WORLD.villages.entries()) {
      const villageGroup = new THREE.Group()
      villageGroup.name = village.name
      const centerY = getSurfaceHeight(village.x, village.z)
      villageGroup.position.set(village.x, centerY, village.z)
      const groundMaterial = this.trackMaterial(
        new THREE.MeshStandardMaterial({
          color: villageIndex === 0 ? 0x6d765c : 0x69735b,
          roughness: 1,
          flatShading: true,
        }),
      )
      this.addMesh(
        villageGroup,
        'VillageGround',
        new THREE.CylinderGeometry(118, 128, 1, 16),
        groundMaterial,
        new THREE.Vector3(0, 0.5, 0),
        false,
        true,
      )
      this.addBox(
        villageGroup,
        'VillageSquare',
        [42, 0.25, 42],
        new THREE.Vector3(0, 1.1, 0),
        this.trackMaterial(new THREE.MeshStandardMaterial({ color: 0x9b806d, roughness: 1 })),
        false,
        true,
      )
      for (const [index, offset] of houseOffsets.entries()) {
        this.createHouse(
          villageGroup,
          `${village.name}House${index + 1}`,
          offset[0],
          offset[1],
          offset[2],
          (index % 2 === 0 ? -1 : 1) * (0.1 + (index % 3) * 0.12),
          villageIndex === 0 ? palettes[0]! : palettes[1]!,
          windowMaterial,
          trimMaterial,
        )
      }
      this.createClockTower(
        villageGroup,
        `${village.name}ClockTower`,
        0,
        -4,
        1.05,
        villageIndex === 0 ? palettes[0]! : palettes[1]!,
        clockMaterial,
        windowMaterial,
      )
      for (let index = 0; index < 6; index += 1) {
        const angle = (index / 6) * Math.PI * 2
        this.addLamp(
          village.x + Math.cos(angle) * 75,
          centerY,
          village.z + Math.sin(angle) * 75,
          4.8,
          0xffb04b,
          angle,
        )
      }
      const villageLight = this.trackLampLight(new THREE.PointLight(0xffa04d, 18, 160, 2))
      villageLight.position.set(village.x, centerY + 24, village.z)
      this.lighting.add(villageLight)
      this.group.add(villageGroup)
    }
  }

  private createHouse(
    parent: THREE.Group,
    name: string,
    x: number,
    z: number,
    scale: number,
    rotation: number,
    palette: HousePalette,
    windowMaterial: THREE.Material,
    trimMaterial: THREE.Material,
  ): void {
    const house = new THREE.Group()
    house.name = name
    house.position.set(x, 0, z)
    house.rotation.y = rotation
    const wallMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.96, flatShading: true }),
    )
    const roofMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.98, flatShading: true }),
    )
    this.addBox(house, 'HouseBody', [13 * scale, 11 * scale, 11 * scale], new THREE.Vector3(0, 5.5 * scale, 0), wallMaterial)
    const roof = this.addMesh(
      house,
      'HouseRoof',
      new THREE.ConeGeometry(9.4 * scale, 7 * scale, 4),
      roofMaterial,
      new THREE.Vector3(0, 14.2 * scale, 0),
    )
    roof.rotation.y = Math.PI * 0.25
    this.addBox(house, 'HouseDoor', [2.3 * scale, 4.8 * scale, 0.35], new THREE.Vector3(0, 2.6 * scale, -5.6 * scale), trimMaterial)
    this.addBox(house, 'HouseWindowLeft', [2.1 * scale, 2.2 * scale, 0.3], new THREE.Vector3(-3.5 * scale, 6.5 * scale, -5.65 * scale), windowMaterial, false, true)
    this.addBox(house, 'HouseWindowRight', [2.1 * scale, 2.2 * scale, 0.3], new THREE.Vector3(3.5 * scale, 6.5 * scale, -5.65 * scale), windowMaterial, false, true)
    this.addBox(house, 'HouseChimney', [1.8 * scale, 5 * scale, 1.8 * scale], new THREE.Vector3(4.8 * scale, 15 * scale, 1.2 * scale), trimMaterial)
    parent.add(house)
  }

  private createClockTower(
    parent: THREE.Group,
    name: string,
    x: number,
    z: number,
    scale: number,
    palette: HousePalette,
    clockMaterial: THREE.Material,
    windowMaterial: THREE.Material,
  ): void {
    const tower = new THREE.Group()
    tower.name = name
    tower.position.set(x, 0, z)
    const wallMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.95, flatShading: true }),
    )
    const roofMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.96, flatShading: true }),
    )
    this.addBox(tower, 'ClockTowerBody', [13 * scale, 34 * scale, 13 * scale], new THREE.Vector3(0, 17 * scale, 0), wallMaterial)
    this.addBox(tower, 'ClockTowerWindow', [4 * scale, 6 * scale, 0.4], new THREE.Vector3(0, 25 * scale, -6.7 * scale), windowMaterial, false, true)
    const face = this.addMesh(
      tower,
      'ClockFace',
      new THREE.CylinderGeometry(4.8 * scale, 4.8 * scale, 0.45, 16),
      clockMaterial,
      new THREE.Vector3(0, 30 * scale, -6.8 * scale),
      false,
      true,
    )
    face.rotation.x = Math.PI * 0.5
    this.addBox(tower, 'ClockHandHour', [0.7 * scale, 3.8 * scale, 0.35], new THREE.Vector3(0, 30 * scale, -7.1 * scale), this.trackMaterial(new THREE.MeshStandardMaterial({ color: 0x403744 })), false, true)
    this.addBox(tower, 'ClockHandMinute', [0.55 * scale, 4.7 * scale, 0.35], new THREE.Vector3(1.2 * scale, 30.2 * scale, -7.15 * scale), this.trackMaterial(new THREE.MeshStandardMaterial({ color: 0x403744 })), false, true)
    const roof = this.addMesh(
      tower,
      'ClockTowerRoof',
      new THREE.ConeGeometry(10 * scale, 9 * scale, 4),
      roofMaterial,
      new THREE.Vector3(0, 38 * scale, 0),
    )
    roof.rotation.y = Math.PI * 0.25
    parent.add(tower)
  }

  private createMountainPass(): void {
    const meadowMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x71835f, roughness: 1, flatShading: true }),
    )
    const rockMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x6e6878, roughness: 1, flatShading: true }),
    )
    const passMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x9d816d, roughness: 1, flatShading: true }),
    )
    const meadowX = WORLD.mountain.passX
    const meadowZ = -885
    const meadowY = getSurfaceHeight(meadowX, meadowZ)
    const meadow = new THREE.Group()
    meadow.name = 'HighMeadow'
    meadow.position.set(meadowX, meadowY, meadowZ)
    this.addMesh(
      meadow,
      'HighMeadowFloor',
      new THREE.CylinderGeometry(102, 118, 1.4, 16),
      meadowMaterial,
      new THREE.Vector3(0, 0.7, 0),
      false,
      true,
    )
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2
      this.addTreeRecord(meadowX + Math.cos(angle) * 90, meadowZ + Math.sin(angle) * 80, 0.65 + (index % 3) * 0.1)
    }
    this.group.add(meadow)

    const passPoints = [
      new THREE.Vector3(55, 0, -690),
      new THREE.Vector3(48, 0, -810),
      new THREE.Vector3(62, 0, -930),
      new THREE.Vector3(55, 0, -1060),
      new THREE.Vector3(80, 0, -1190),
    ]
    for (const point of passPoints) {
      point.y = getSurfaceHeight(point.x, point.z) + 0.65
    }
    const highPassTrail = createRibbon(passPoints, 11, passMaterial, 'HighPassTrail')
    this.trackGeometry(highPassTrail.geometry)
    this.group.add(highPassTrail)

    const mountainFeatures = new THREE.Group()
    mountainFeatures.name = 'MountainSpineFeatures'
    const peaks: readonly { x: number; z: number; radius: number; height: number }[] = [
      { x: -410, z: -1110, radius: 96, height: 72 },
      { x: 470, z: -1160, radius: 86, height: 64 },
      { x: 830, z: -1050, radius: 72, height: 50 },
    ]
    for (const [index, peak] of peaks.entries()) {
      const baseY = getTerrainHeight(peak.x, peak.z)
      const peakMesh = this.addMesh(
        mountainFeatures,
        'MountainPeak',
        new THREE.ConeGeometry(peak.radius, peak.height, 7),
        rockMaterial,
        new THREE.Vector3(peak.x, baseY + peak.height * 0.5 - 16, peak.z),
        true,
        true,
      )
      peakMesh.rotation.y = index * 0.47
    }
    for (let index = 0; index < 8; index += 1) {
      const z = -760 - index * 78
      const x = 55 + Math.sin(index * 1.7) * 24
      const baseY = getTerrainHeight(x, z)
      const cairn = this.addMesh(
        mountainFeatures,
        'PassCairn',
        new THREE.DodecahedronGeometry(7 - index * 0.25, 0),
        rockMaterial,
        new THREE.Vector3(x, baseY + 5, z),
      )
      cairn.scale.y = 1.5
      cairn.scale.x = 0.8
    }
    this.group.add(mountainFeatures)
  }

  private createLighthouse(): void {
    const groundY = getSurfaceHeight(WORLD.lighthouse.x, WORLD.lighthouse.z)
    this.lighthouse.name = 'AmberlightLighthouse'
    this.lighthouse.position.set(WORLD.lighthouse.x, groundY, WORLD.lighthouse.z)
    const stoneMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x8a8184, roughness: 0.98, flatShading: true }),
    )
    const darkMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x303744, roughness: 0.8, flatShading: true }),
    )
    const warmMaterial = this.trackLampMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xffc36a,
        emissive: 0xff762d,
        emissiveIntensity: 3.6,
        roughness: 0.4,
      }),
    )
    this.addMesh(
      this.lighthouse,
      'LighthouseFoundation',
      new THREE.CylinderGeometry(31, 38, 12, 10),
      darkMaterial,
      new THREE.Vector3(0, 5, 0),
    )
    this.addMesh(
      this.lighthouse,
      'LighthouseTower',
      new THREE.CylinderGeometry(12, 21, WORLD.lighthouse.baseHeight + 28, 8),
      stoneMaterial,
      new THREE.Vector3(0, 29 + WORLD.lighthouse.baseHeight * 0.5, 0),
    )
    this.addMesh(
      this.lighthouse,
      'LighthouseGallery',
      new THREE.CylinderGeometry(18, 18, 5, 10),
      darkMaterial,
      new THREE.Vector3(0, 64 + WORLD.lighthouse.baseHeight * 0.5, 0),
    )
    this.addMesh(
      this.lighthouse,
      'LighthouseLanternRoom',
      new THREE.CylinderGeometry(10, 10, 13, 8),
      warmMaterial,
      new THREE.Vector3(0, 74 + WORLD.lighthouse.baseHeight * 0.5, 0),
    )
    const roof = this.addMesh(
      this.lighthouse,
      'LighthouseRoof',
      new THREE.ConeGeometry(15, 10, 8),
      darkMaterial,
      new THREE.Vector3(0, 86 + WORLD.lighthouse.baseHeight * 0.5, 0),
    )
    roof.rotation.y = Math.PI * 0.125
    this.lighthouseBeam.name = 'RotatingLighthouseBeam'
    this.lighthouseBeam.position.set(0, 72 + WORLD.lighthouse.baseHeight * 0.5, 0)
    this.lighthouseBeamMaterial = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xffd38c,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    )
    const beam = this.addMesh(
      this.lighthouseBeam,
      'LighthouseLightCone',
      new THREE.ConeGeometry(30, 220, 12, 1, true),
      this.lighthouseBeamMaterial,
      new THREE.Vector3(96, 0, 0),
      false,
      false,
    )
    beam.rotation.z = Math.PI * 0.5
    this.addMesh(
      this.lighthouseBeam,
      'LighthouseLens',
      new THREE.SphereGeometry(4.2, 12, 8),
      warmMaterial,
      new THREE.Vector3(0, 0, 0),
      false,
      false,
    )
    this.lighthouse.add(this.lighthouseBeam)
    const beacon = this.trackLampLight(new THREE.PointLight(0xffa343, 22, 170, 2))
    beacon.position.set(WORLD.lighthouse.x, groundY + 84, WORLD.lighthouse.z)
    this.lighting.add(beacon)
    this.group.add(this.lighthouse)
  }

  private createLanternRing(): void {
    const centerX = getRiverCenterX(-360)
    this.lanternRing.name = 'FloatingRiverLanternRing'
    this.lanternRing.position.set(centerX, WORLD.waterLevel + 38, -360)
    this.lanternRingMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xf09b4a,
        emissive: 0xd85b2e,
        emissiveIntensity: 2.4,
        roughness: 0.7,
      }),
    )
    this.addMesh(
      this.lanternRing,
      'LanternRing',
      new THREE.TorusGeometry(24, 0.7, 8, 40),
      this.lanternRingMaterial,
      new THREE.Vector3(0, 0, 0),
      false,
      false,
    )
    const lanternGeometry = this.trackGeometry(new THREE.BoxGeometry(2.1, 2.8, 2.1))
    const lanternMesh = new THREE.InstancedMesh(lanternGeometry, this.lanternMaterial, 12)
    lanternMesh.name = 'RiverLanterns'
    const dummy = new THREE.Object3D()
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2
      dummy.position.set(Math.cos(angle) * 24, Math.sin(angle) * 24, 0)
      dummy.rotation.z = -angle
      dummy.updateMatrix()
      lanternMesh.setMatrixAt(index, dummy.matrix)
    }
    lanternMesh.instanceMatrix.needsUpdate = true
    lanternMesh.castShadow = false
    lanternMesh.frustumCulled = false
    this.lanternRing.add(lanternMesh)
    this.lanternRing.add(this.lanternLight)
    this.group.add(this.lanternRing)
  }

  private createClouds(): void {
    const geometry = this.trackGeometry(new THREE.IcosahedronGeometry(1, 1))
    this.worldCloudMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x96869e,
        roughness: 1,
        flatShading: true,
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
      }),
    )
    for (let index = 0; index < 8; index += 1) {
      const cloud = new THREE.Group()
      cloud.name = `SparseWorldCloud${index + 1}`
      const pieces = 3 + (index % 3)
      for (let piece = 0; piece < pieces; piece += 1) {
        const mesh = new THREE.Mesh(geometry, this.worldCloudMaterial)
        mesh.position.set((piece - 1) * 35, this.random() * 18, (this.random() - 0.5) * 34)
        mesh.scale.set(55 + this.random() * 35, 12 + this.random() * 12, 28 + this.random() * 24)
        mesh.rotation.y = this.random() * Math.PI
        cloud.add(mesh)
      }
      const baseX = -1300 + index * 390 + this.random() * 130
      const baseZ = -1050 + (index % 3) * 790 + this.random() * 180
      const baseY = 560 + this.random() * 250
      cloud.position.set(baseX, baseY, baseZ)
      this.cloudLayer.add(cloud)
      this.cloudRecords.push({
        object: cloud,
        baseX,
        baseY,
        baseZ,
        phase: this.random() * Math.PI * 2,
        drift: 0.0008 + this.random() * 0.001,
      })
    }
  }

  private addLamp(
    x: number,
    y: number,
    z: number,
    height: number,
    color: THREE.ColorRepresentation,
    rotation = 0,
  ): void {
    this.lampData.push({ x, y, z, height, rotation, color: new THREE.Color(color) })
  }

  private createLamps(): void {
    if (this.lampData.length === 0) {
      return
    }
    const postGeometry = this.trackGeometry(new THREE.CylinderGeometry(0.22, 0.34, 4, 6))
    const bulbGeometry = this.trackGeometry(new THREE.SphereGeometry(0.7, 8, 6))
    const postMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x383641, roughness: 0.8, flatShading: true, vertexColors: true }),
    )
    const bulbMaterial = this.trackLampMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xffb04c,
        emissive: 0xff682d,
        emissiveIntensity: 3.4,
        roughness: 0.42,
        vertexColors: true,
      }),
    )
    const posts = new THREE.InstancedMesh(postGeometry, postMaterial, this.lampData.length)
    const bulbs = new THREE.InstancedMesh(bulbGeometry, bulbMaterial, this.lampData.length)
    posts.name = 'InstancedLampPosts'
    bulbs.name = 'InstancedWarmLamps'
    const dummy = new THREE.Object3D()
    const postColor = new THREE.Color()
    for (const [index, lamp] of this.lampData.entries()) {
      dummy.position.set(lamp.x, lamp.y + lamp.height * 0.5, lamp.z)
      dummy.rotation.set(0, lamp.rotation, 0)
      dummy.scale.set(1, lamp.height / 4, 1)
      dummy.updateMatrix()
      posts.setMatrixAt(index, dummy.matrix)
      postColor.setHex(0x47424a)
      posts.setColorAt(index, postColor)
      dummy.position.set(lamp.x, lamp.y + lamp.height + 0.45, lamp.z)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      bulbs.setMatrixAt(index, dummy.matrix)
      bulbs.setColorAt(index, lamp.color)
    }
    posts.instanceMatrix.needsUpdate = true
    bulbs.instanceMatrix.needsUpdate = true
    if (posts.instanceColor) {
      posts.instanceColor.needsUpdate = true
    }
    if (bulbs.instanceColor) {
      bulbs.instanceColor.needsUpdate = true
    }
    posts.castShadow = true
    bulbs.castShadow = false
    posts.receiveShadow = true
    bulbs.receiveShadow = false
    this.lampMeshes.push(posts, bulbs)
    this.group.add(posts, bulbs)
  }

  private addTreeRecord(x: number, z: number, scale: number): void {
    if (!this.isTreeLocation(x, z)) {
      return
    }
    this.treeData.push({
      x,
      y: getSurfaceHeight(x, z),
      z,
      scale,
      rotation: this.random() * Math.PI * 2,
      tint: this.random(),
    })
  }

  private isTreeLocation(x: number, z: number): boolean {
    const height = getTerrainHeight(x, z)
    if (height < WORLD.waterLevel + 3 || isWaterAt(x, z) || isAirfieldPoint(x, z) || isRunwayPoint(x, z)) {
      return false
    }
    for (const village of WORLD.villages) {
      if (Math.sqrt((x - village.x) ** 2 + (z - village.z) ** 2) < 128) {
        return false
      }
    }
    for (const point of this.pathSamples) {
      if ((x - point.x) ** 2 + (z - point.z) ** 2 < 22 ** 2) {
        return false
      }
    }
    return true
  }

  private createTrees(): void {
    const clusters: readonly { x: number; z: number; radius: number; count: number }[] = [
      { x: -1190, z: -520, radius: 310, count: 92 },
      { x: -1310, z: 500, radius: 280, count: 76 },
      { x: 1030, z: -610, radius: 330, count: 90 },
      { x: 1110, z: 580, radius: 280, count: 72 },
      { x: 350, z: -850, radius: 250, count: 65 },
      { x: -930, z: 150, radius: 210, count: 56 },
      { x: 890, z: 40, radius: 180, count: 48 },
    ]
    for (const cluster of clusters) {
      for (let index = 0; index < cluster.count; index += 1) {
        const angle = this.random() * Math.PI * 2
        const radius = Math.sqrt(this.random()) * cluster.radius
        this.addTreeRecord(
          cluster.x + Math.cos(angle) * radius,
          cluster.z + Math.sin(angle) * radius,
          0.72 + this.random() * 0.65,
        )
      }
    }
    if (this.treeData.length === 0) {
      return
    }

    const trunkGeometry = this.trackGeometry(new THREE.CylinderGeometry(0.7, 1.05, 5.5, 6))
    const lowerCanopyGeometry = this.trackGeometry(new THREE.ConeGeometry(5.4, 10, 7))
    const upperCanopyGeometry = this.trackGeometry(new THREE.ConeGeometry(3.5, 7.5, 6))
    const trunkMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x4b3942, roughness: 1, flatShading: true, vertexColors: true }),
    )
    const lowerMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x4d6755, roughness: 1, flatShading: true, vertexColors: true }),
    )
    const upperMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x60765d, roughness: 1, flatShading: true, vertexColors: true }),
    )
    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, this.treeData.length)
    const lowerCanopies = new THREE.InstancedMesh(lowerCanopyGeometry, lowerMaterial, this.treeData.length)
    const upperCanopies = new THREE.InstancedMesh(upperCanopyGeometry, upperMaterial, this.treeData.length)
    trunks.name = 'InstancedTreeTrunks'
    lowerCanopies.name = 'InstancedLowerCanopies'
    upperCanopies.name = 'InstancedUpperCanopies'
    const dummy = new THREE.Object3D()
    const lowerColor = new THREE.Color()
    const upperColor = new THREE.Color()
    for (const [index, tree] of this.treeData.entries()) {
      dummy.position.set(tree.x, tree.y + 2.75 * tree.scale, tree.z)
      dummy.rotation.set(0, tree.rotation, 0)
      dummy.scale.set(tree.scale, tree.scale, tree.scale)
      dummy.updateMatrix()
      trunks.setMatrixAt(index, dummy.matrix)
      dummy.position.set(tree.x, tree.y + 8 * tree.scale, tree.z)
      dummy.rotation.set(0, tree.rotation + 0.2, 0)
      dummy.scale.set(tree.scale, tree.scale, tree.scale)
      dummy.updateMatrix()
      lowerCanopies.setMatrixAt(index, dummy.matrix)
      dummy.position.set(tree.x, tree.y + 12.4 * tree.scale, tree.z)
      dummy.rotation.set(0, tree.rotation - 0.25, 0)
      dummy.scale.set(tree.scale, tree.scale, tree.scale)
      dummy.updateMatrix()
      upperCanopies.setMatrixAt(index, dummy.matrix)
      lowerColor.setHSL(0.29 + tree.tint * 0.035, 0.25, 0.25 + tree.tint * 0.07)
      upperColor.setHSL(0.27 + tree.tint * 0.04, 0.22, 0.34 + tree.tint * 0.08)
      lowerCanopies.setColorAt(index, lowerColor)
      upperCanopies.setColorAt(index, upperColor)
    }
    for (const mesh of [trunks, lowerCanopies, upperCanopies]) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true
      }
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.computeBoundingSphere()
      this.treeMeshes.push(mesh)
      this.group.add(mesh)
    }
  }
}
