import * as THREE from 'three'
import { clamp, damp, lerp } from '../core/math'

export interface AircraftFlightState {
  throttle?: number
  speed?: number
  airspeed?: number
  groundSpeed?: number
  velocity?: number | { readonly x?: number; readonly y: number; readonly z?: number }
  verticalSpeed?: number
  grounded?: boolean
  wheelCompression?: number
  engineRunning?: boolean
  flaps?: number
}

export interface AircraftControls {
  throttle?: number
  aileron?: number
  elevator?: number
  rudder?: number
  roll?: number
  pitch?: number
  yaw?: number
  flaps?: number
}

export interface AircraftVisualOptions {
  exhaust?: boolean
}

type ExhaustPuff = {
  mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>
  age: number
  life: number
  strength: number
  drift: THREE.Vector3
}

type LandingStrut = {
  mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>
  anchor: THREE.Vector3
  axle: THREE.Vector3
}

const CREAM = 0xe8dfc8
const BRICK_RED = 0x963f32
const DEEP_RED = 0x672a24
const BRASS = 0xb48a45
const DARK_BRASS = 0x6f542d
const TIRE = 0x252321
const GLASS = 0x18343a
const CABIN_GLOW = 0xffc979

const UP = new THREE.Vector3(0, 1, 0)
const TEMP_DIRECTION = new THREE.Vector3()

const makeMaterial = (
  color: number,
  roughness: number,
  metalness: number,
): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: true,
  })

const addMesh = <Geometry extends THREE.BufferGeometry, MaterialType extends THREE.Material>(
  parent: THREE.Object3D,
  geometry: Geometry,
  material: MaterialType,
  position: readonly [number, number, number] = [0, 0, 0],
  rotation: readonly [number, number, number] = [0, 0, 0],
): THREE.Mesh<Geometry, MaterialType> => {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

const horizontalPrism = (
  points: readonly (readonly [number, number])[],
  thickness: number,
  side = 1,
): THREE.ExtrudeGeometry => {
  const shape = new THREE.Shape()
  points.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x * side, z)
    else shape.lineTo(x * side, z)
  })
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  })
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, thickness / 2, 0)
  geometry.computeVertexNormals()
  return geometry
}

const verticalPrism = (
  points: readonly (readonly [number, number])[],
  thickness: number,
): THREE.ExtrudeGeometry => {
  const shape = new THREE.Shape()
  points.forEach(([z, y], index) => {
    if (index === 0) shape.moveTo(-z, y)
    else shape.lineTo(-z, y)
  })
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  })
  geometry.rotateY(Math.PI / 2)
  geometry.translate(-thickness / 2, 0, 0)
  geometry.computeVertexNormals()
  return geometry
}

const setRodBetween = (
  mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>,
  start: THREE.Vector3,
  end: THREE.Vector3,
): void => {
  TEMP_DIRECTION.subVectors(end, start)
  const length = Math.max(TEMP_DIRECTION.length(), 0.001)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(UP, TEMP_DIRECTION.multiplyScalar(1 / length))
  mesh.scale.set(1, length, 1)
}

const makeLandingStrut = (
  parent: THREE.Object3D,
  anchor: THREE.Vector3,
  axle: THREE.Vector3,
  radius: number,
  material: THREE.MeshStandardMaterial,
): LandingStrut => {
  const geometry = new THREE.CylinderGeometry(radius, radius * 1.08, 1, 6)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return { mesh, anchor, axle }
}

const makeWheel = (
  parent: THREE.Object3D,
  position: readonly [number, number, number],
  radius: number,
  tireMaterial: THREE.MeshStandardMaterial,
  hubMaterial: THREE.MeshStandardMaterial,
): THREE.Group => {
  const wheel = new THREE.Group()
  wheel.position.set(...position)
  parent.add(wheel)

  const tire = addMesh(
    wheel,
    new THREE.TorusGeometry(radius * 0.68, radius * 0.32, 6, 10),
    tireMaterial,
    [0, 0, 0],
    [0, Math.PI / 2, 0],
  )
  tire.castShadow = true

  addMesh(
    wheel,
    new THREE.CylinderGeometry(radius * 0.48, radius * 0.48, radius * 0.76, 10),
    hubMaterial,
    [0, 0, 0],
    [0, 0, Math.PI / 2],
  )
  addMesh(
    wheel,
    new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, radius * 0.82, 8),
    tireMaterial,
    [0, 0, 0],
    [0, 0, Math.PI / 2],
  )

  return wheel
}

export class AircraftVisual {
  readonly root: THREE.Group

  private readonly airframe = new THREE.Group()
  private readonly landingGear = new THREE.Group()
  private readonly cockpitInterior = new THREE.Group()
  private readonly propeller = new THREE.Group()
  private readonly propellerBlur: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>
  private readonly leftAileron = new THREE.Group()
  private readonly rightAileron = new THREE.Group()
  private readonly leftFlap = new THREE.Group()
  private readonly rightFlap = new THREE.Group()
  private readonly leftElevator = new THREE.Group()
  private readonly rightElevator = new THREE.Group()
  private readonly rudder = new THREE.Group()
  private readonly mainWheels: readonly [THREE.Group, THREE.Group]
  private readonly noseWheel: THREE.Group
  private readonly landingStruts: LandingStrut[] = []
  private readonly strutAnchor = new THREE.Vector3()
  private readonly exhaustPuffs: ExhaustPuff[] = []
  private readonly redLightMaterial: THREE.MeshStandardMaterial
  private readonly greenLightMaterial: THREE.MeshStandardMaterial
  private readonly whiteLightMaterial: THREE.MeshStandardMaterial
  private readonly redLight: THREE.PointLight
  private readonly greenLight: THREE.PointLight
  private readonly whiteLight: THREE.PointLight
  private readonly cabinLight: THREE.PointLight
  private readonly cabinGlowMaterial: THREE.MeshStandardMaterial
  private readonly exhaustEnabled: boolean
  private propellerAngle = 0
  private wheelAngle = 0
  private lastTime: number | null = null
  private exhaustTimer = 0
  private exhaustCursor = 0
  private compression = 0

  constructor(parent?: THREE.Object3D, options: AircraftVisualOptions = {}) {
    this.root = new THREE.Group()
    this.root.name = 'aircraft-visual'
    this.root.add(this.airframe, this.landingGear, this.cockpitInterior)
    this.cockpitInterior.visible = false
    parent?.add(this.root)

    const cream = makeMaterial(CREAM, 0.68, 0.12)
    const creamShade = makeMaterial(0xd4c6aa, 0.76, 0.1)
    const red = makeMaterial(BRICK_RED, 0.62, 0.18)
    const deepRed = makeMaterial(DEEP_RED, 0.66, 0.14)
    const brass = makeMaterial(BRASS, 0.34, 0.72)
    const darkBrass = makeMaterial(DARK_BRASS, 0.48, 0.58)
    const tire = makeMaterial(TIRE, 0.94, 0.02)
    const interior = makeMaterial(0x6b5140, 0.82, 0.04)
    interior.emissive.set(0x1b100c)
    interior.emissiveIntensity = 0.28
    const glass = new THREE.MeshStandardMaterial({
      color: GLASS,
      roughness: 0.18,
      metalness: 0.48,
      emissive: 0x071b20,
      emissiveIntensity: 0.32,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      flatShading: true,
    })

    this.redLightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3028,
      emissive: 0xff160f,
      emissiveIntensity: 2.1,
      roughness: 0.25,
      flatShading: true,
    })
    this.greenLightMaterial = new THREE.MeshStandardMaterial({
      color: 0x39ef72,
      emissive: 0x0bbf42,
      emissiveIntensity: 2.1,
      roughness: 0.25,
      flatShading: true,
    })
    this.whiteLightMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff4d7,
      emissive: 0xffe7b0,
      emissiveIntensity: 1.7,
      roughness: 0.2,
      flatShading: true,
    })
    this.cabinGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0xd89b55,
      emissive: CABIN_GLOW,
      emissiveIntensity: 0.42,
      roughness: 0.62,
      flatShading: true,
    })

    addMesh(
      this.airframe,
      new THREE.CylinderGeometry(0.62, 1.03, 5.55, 10),
      cream,
      [0, 0, 1.58],
      [Math.PI / 2, 0, 0],
    )
    const cabin = addMesh(
      this.airframe,
      new THREE.SphereGeometry(1, 12, 8),
      cream,
      [0, 0.38, 0.38],
    )
    cabin.scale.set(1.02, 0.9, 1.58)
    const belly = addMesh(
      this.airframe,
      new THREE.SphereGeometry(1, 10, 6),
      red,
      [0, -0.72, 1.42],
    )
    belly.scale.set(0.77, 0.27, 2.05)
    addMesh(
      this.airframe,
      new THREE.CylinderGeometry(0.15, 0.72, 2.45, 8),
      creamShade,
      [0, 0.03, 4.82],
      [Math.PI / 2, 0, 0],
    )
    const cowling = addMesh(
      this.airframe,
      new THREE.SphereGeometry(1, 12, 8),
      red,
      [0, 0.02, -1.58],
    )
    cowling.scale.set(1.13, 1, 1.08)
    addMesh(
      this.airframe,
      new THREE.TorusGeometry(0.91, 0.075, 6, 16),
      brass,
      [0, 0.02, -2.18],
    )
    const grilleMaterial = new THREE.MeshStandardMaterial({
      color: 0x201d1a,
      roughness: 0.72,
      metalness: 0.25,
      side: THREE.DoubleSide,
      flatShading: true,
    })
    addMesh(
      this.airframe,
      new THREE.CircleGeometry(0.63, 12),
      grilleMaterial,
      [0, 0.02, -2.665],
    )
    for (const y of [-0.25, 0, 0.25]) {
      addMesh(
        this.airframe,
        new THREE.BoxGeometry(0.95, 0.035, 0.035),
        darkBrass,
        [0, y + 0.02, -2.69],
      )
    }

    for (const side of [-1, 1]) {
      addMesh(
        this.airframe,
        new THREE.BoxGeometry(0.045, 0.25, 2.25),
        red,
        [side * 0.99, 0.08, 1.38],
        [0, 0, side * 0.025],
      )
    }

    addMesh(
      this.airframe,
      new THREE.BoxGeometry(1.72, 0.18, 0.78),
      interior,
      [0, 0.48, -0.52],
    )
    addMesh(
      this.airframe,
      new THREE.BoxGeometry(1.65, 0.12, 0.62),
      this.cabinGlowMaterial,
      [0, 0.55, 0.12],
    )
    for (const side of [-1, 1]) {
      addMesh(
        this.airframe,
        new THREE.BoxGeometry(0.48, 0.58, 0.48),
        deepRed,
        [side * 0.43, 0.53, 0.34],
      )
      addMesh(
        this.airframe,
        new THREE.BoxGeometry(0.72, 0.6, 0.065),
        glass,
        [side * 0.47, 0.93, -0.89],
        [-0.34, side * 0.04, side * 0.03],
      )
      addMesh(
        this.airframe,
        new THREE.BoxGeometry(0.045, 0.53, 0.78),
        glass,
        [side * 1.005, 0.85, -0.16],
        [0, 0, side * -0.025],
      )
      addMesh(
        this.airframe,
        new THREE.BoxGeometry(0.045, 0.43, 0.58),
        glass,
        [side * 0.98, 0.8, 0.73],
        [0, 0, side * -0.04],
      )
    }
    addMesh(
      this.airframe,
      new THREE.BoxGeometry(0.045, 0.72, 0.06),
      brass,
      [0, 0.92, -0.89],
      [-0.34, 0, 0],
    )

    addMesh(
      this.airframe,
      new THREE.BoxGeometry(2.05, 0.2, 1.68),
      cream,
      [0, 1.4, -0.1],
    )
    for (const side of [-1, 1]) {
      const wing = new THREE.Group()
      wing.position.y = 1.42
      wing.rotation.z = side * 0.035
      this.airframe.add(wing)
      addMesh(
        wing,
        horizontalPrism(
          [
            [0, -0.94],
            [6.7, -0.42],
            [6.7, 0.52],
            [0, 0.72],
          ],
          0.18,
          side,
        ),
        cream,
      )
      addMesh(
        wing,
        new THREE.BoxGeometry(0.76, 0.205, 0.84),
        red,
        [side * 6.32, 0.005, 0.04],
      )
      addMesh(
        wing,
        horizontalPrism(
          [
            [0.12, -0.925],
            [6.55, -0.41],
            [6.55, -0.3],
            [0.12, -0.815],
          ],
          0.035,
          side,
        ),
        brass,
        [0, 0.1, 0],
      )

      const flap = side < 0 ? this.leftFlap : this.rightFlap
      flap.position.set(side * 2.48, -0.025, 0.68)
      wing.add(flap)
      addMesh(flap, new THREE.BoxGeometry(2.92, 0.11, 0.56), creamShade, [0, 0, 0.28])
      addMesh(flap, new THREE.BoxGeometry(2.82, 0.045, 0.055), brass, [0, 0.06, 0.04])

      const aileron = side < 0 ? this.leftAileron : this.rightAileron
      aileron.position.set(side * 5.12, -0.012, 0.5)
      wing.add(aileron)
      addMesh(aileron, new THREE.BoxGeometry(2.38, 0.11, 0.47), red, [0, 0, 0.235])
      addMesh(aileron, new THREE.BoxGeometry(2.28, 0.045, 0.05), brass, [0, 0.06, 0.03])

      addMesh(
        wing,
        new THREE.CylinderGeometry(0.14, 0.17, 0.12, 8),
        darkBrass,
        [side * 6.82, 0.08, 0.05],
      )
      addMesh(
        wing,
        new THREE.SphereGeometry(0.105, 8, 5),
        side < 0 ? this.redLightMaterial : this.greenLightMaterial,
        [side * 6.86, 0.17, 0.05],
      )
    }

    this.redLight = new THREE.PointLight(0xff1d16, 0.72, 3.4, 2)
    this.redLight.position.set(-6.86, 0.22, 0.05)
    this.airframe.add(this.redLight)
    this.greenLight = new THREE.PointLight(0x22e566, 0.72, 3.4, 2)
    this.greenLight.position.set(6.86, 0.22, 0.05)
    this.airframe.add(this.greenLight)

    for (const side of [-1, 1]) {
      const stabilizer = new THREE.Group()
      stabilizer.position.set(0, 0.7, 0)
      this.airframe.add(stabilizer)
      addMesh(
        stabilizer,
        horizontalPrism(
          [
            [0.35, 4.28],
            [3.05, 4.62],
            [3.05, 5.52],
            [0.35, 5.62],
          ],
          0.15,
          side,
        ),
        cream,
      )
      addMesh(
        stabilizer,
        new THREE.BoxGeometry(0.58, 0.17, 0.76),
        red,
        [side * 2.73, 0, 5.03],
      )
      const elevator = side < 0 ? this.leftElevator : this.rightElevator
      elevator.position.set(side * 1.58, -0.01, 5.61)
      stabilizer.add(elevator)
      addMesh(elevator, new THREE.BoxGeometry(2.75, 0.11, 0.62), red, [0, 0, 0.31])
      addMesh(elevator, new THREE.BoxGeometry(2.65, 0.045, 0.055), brass, [0, 0.06, 0.04])
    }

    addMesh(
      this.airframe,
      verticalPrism(
        [
          [3.98, 0.52],
          [4.22, 2.53],
          [5.08, 3.3],
          [5.78, 2.05],
          [5.78, 0.52],
        ],
        0.19,
      ),
      red,
    )
    for (const side of [-1, 1]) {
      addMesh(
        this.airframe,
        new THREE.BoxGeometry(0.025, 0.28, 1.08),
        cream,
        [side * 0.108, 2.18, 4.91],
        [0.08, 0, 0],
      )
    }
    this.rudder.position.z = 5.76
    this.airframe.add(this.rudder)
    addMesh(
      this.rudder,
      verticalPrism(
        [
          [0, 0.53],
          [0.67, 1.9],
          [0.67, 3.13],
          [0, 3.28],
        ],
        0.16,
      ),
      deepRed,
    )
    addMesh(
      this.airframe,
      new THREE.CylinderGeometry(0.14, 0.16, 0.12, 8),
      darkBrass,
      [0, 0.84, 6.47],
      [Math.PI / 2, 0, 0],
    )
    addMesh(
      this.airframe,
      new THREE.SphereGeometry(0.095, 8, 5),
      this.whiteLightMaterial,
      [0, 0.84, 6.56],
    )
    this.whiteLight = new THREE.PointLight(0xffe6b5, 0.42, 2.8, 2)
    this.whiteLight.position.set(0, 0.84, 6.65)
    this.airframe.add(this.whiteLight)
    this.cabinLight = new THREE.PointLight(CABIN_GLOW, 0.48, 4.2, 2)
    this.cabinLight.position.set(0, 0.66, 0.18)
    this.airframe.add(this.cabinLight)

    const leftTailBrace = makeLandingStrut(
      this.airframe,
      new THREE.Vector3(0, 1.15, 4.35),
      new THREE.Vector3(-1.65, 0.82, 5.15),
      0.025,
      darkBrass,
    )
    const rightTailBrace = makeLandingStrut(
      this.airframe,
      new THREE.Vector3(0, 1.15, 4.35),
      new THREE.Vector3(1.65, 0.82, 5.15),
      0.025,
      darkBrass,
    )
    setRodBetween(leftTailBrace.mesh, leftTailBrace.anchor, leftTailBrace.axle)
    setRodBetween(rightTailBrace.mesh, rightTailBrace.anchor, rightTailBrace.axle)

    this.propeller.position.set(0, 0.16, -2.93)
    this.airframe.add(this.propeller)
    addMesh(
      this.propeller,
      new THREE.CylinderGeometry(0.25, 0.25, 0.32, 10),
      darkBrass,
      [0, 0, 0],
      [Math.PI / 2, 0, 0],
    )
    const bladeShape = new THREE.Shape()
    bladeShape.moveTo(-0.085, -0.7)
    bladeShape.lineTo(-0.15, 0.3)
    bladeShape.lineTo(-0.075, 1.16)
    bladeShape.lineTo(0.035, 1.35)
    bladeShape.lineTo(0.14, 1.14)
    bladeShape.lineTo(0.12, 0.28)
    bladeShape.lineTo(0.075, -0.7)
    bladeShape.closePath()
    const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.075,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    })
    bladeGeometry.translate(0, 0, -0.0375)
    addMesh(this.propeller, bladeGeometry, brass)
    addMesh(
      this.propeller,
      new THREE.BoxGeometry(0.18, 0.24, 0.09),
      cream,
      [0, 1.2, 0],
    )
    const lowerBlade = addMesh(this.propeller, bladeGeometry, brass)
    lowerBlade.rotation.z = Math.PI
    addMesh(
      this.propeller,
      new THREE.BoxGeometry(0.18, 0.24, 0.09),
      cream,
      [0, -1.2, 0],
      [0, 0, Math.PI],
    )
    addMesh(
      this.propeller,
      new THREE.ConeGeometry(0.23, 0.56, 8),
      brass,
      [0, 0, -0.27],
      [-Math.PI / 2, 0, 0],
    )
    this.propellerBlur = addMesh(
      this.airframe,
      new THREE.CircleGeometry(1.42, 24),
      new THREE.MeshBasicMaterial({
        color: 0xd6c7a6,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      [0, 0.16, -2.92],
    )
    this.propellerBlur.castShadow = false
    this.propellerBlur.receiveShadow = false

    addMesh(
      this.airframe,
      new THREE.CylinderGeometry(0.07, 0.09, 0.42, 6),
      darkBrass,
      [0.5, -0.47, -2.05],
      [Math.PI / 2, 0, -0.42],
    )

    const leftMainWheel = makeWheel(
      this.landingGear,
      [-2.25, -0.96, 0.72],
      0.46,
      tire,
      brass,
    )
    const rightMainWheel = makeWheel(
      this.landingGear,
      [2.25, -0.96, 0.72],
      0.46,
      tire,
      brass,
    )
    this.noseWheel = makeWheel(
      this.landingGear,
      [0, -1.08, -1.74],
      0.34,
      tire,
      darkBrass,
    )
    this.mainWheels = [leftMainWheel, rightMainWheel]

    for (const side of [-1, 1]) {
      const axle = new THREE.Vector3(side * 2.25, -0.96, 0.72)
      this.landingStruts.push(
        makeLandingStrut(
          this.landingGear,
          new THREE.Vector3(side * 0.78, 0.48, 0.26),
          axle,
          0.065,
          darkBrass,
        ),
        makeLandingStrut(
          this.landingGear,
          new THREE.Vector3(side * 0.55, -0.15, -0.08),
          axle,
          0.042,
          brass,
        ),
      )
    }
    this.landingStruts.push(
      makeLandingStrut(
        this.landingGear,
        new THREE.Vector3(0, -0.48, -1.28),
        new THREE.Vector3(0, -1.08, -1.74),
        0.052,
        darkBrass,
      ),
      makeLandingStrut(
        this.landingGear,
        new THREE.Vector3(0, -0.3, -0.98),
        new THREE.Vector3(0, -1.08, -1.74),
        0.034,
        brass,
      ),
    )

    const cockpitPanel = addMesh(
      this.cockpitInterior,
      new THREE.BoxGeometry(1.72, 0.24, 0.16),
      interior,
      [0, 0.18, -1.62],
      [-0.12, 0, 0],
    )
    cockpitPanel.castShadow = false
    cockpitPanel.receiveShadow = false
    for (const x of [-0.38, 0.38]) {
      const gauge = addMesh(
        this.cockpitInterior,
        new THREE.CylinderGeometry(0.11, 0.11, 0.04, 12),
        this.cabinGlowMaterial,
        [x, 0.34, -1.54],
        [Math.PI * 0.5, 0, 0],
      )
      gauge.castShadow = false
      gauge.receiveShadow = false
    }
    for (const side of [-1, 1]) {
      addMesh(
        this.cockpitInterior,
        new THREE.BoxGeometry(0.035, 0.9, 0.035),
        darkBrass,
        [side * 0.78, 0.7, -0.96],
      )
    }
    addMesh(
      this.cockpitInterior,
      new THREE.BoxGeometry(1.55, 0.035, 0.06),
      darkBrass,
      [0, 1.15, -0.96],
    )

    this.exhaustEnabled = options.exhaust ?? true
    if (this.exhaustEnabled) {
      const geometry = new THREE.IcosahedronGeometry(0.22, 1)
      for (let index = 0; index < 7; index += 1) {
        const material = new THREE.MeshBasicMaterial({
          color: 0x716860,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.visible = false
        this.airframe.add(mesh)
        this.exhaustPuffs.push({
          mesh,
          age: 0,
          life: 1,
          strength: 0,
          drift: new THREE.Vector3(),
        })
      }
    }

    this.updateLandingStruts()
  }

  setCockpitMode(enabled: boolean): void {
    this.airframe.visible = !enabled
    this.landingGear.visible = !enabled
    this.cockpitInterior.visible = enabled
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry)
        const material = object.material
        if (Array.isArray(material)) material.forEach((entry) => materials.add(entry))
        else materials.add(material)
      }
    })
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
    this.root.removeFromParent()
  }

  update(
    time: number,
    flightState: AircraftFlightState = {},
    controls: AircraftControls = {},
  ): void {
    const delta = this.lastTime === null ? 0 : clamp(time - this.lastTime, 0, 0.25)
    this.lastTime = time

    const requestedThrottle = clamp(controls.throttle ?? flightState.throttle ?? 0, 0, 1)
    const running = flightState.engineRunning ?? requestedThrottle > 0.015
    const throttle = running ? requestedThrottle : 0
    const aileron = clamp(controls.aileron ?? controls.roll ?? 0, -1, 1)
    const elevator = clamp(controls.elevator ?? controls.pitch ?? 0, -1, 1)
    const rudder = clamp(controls.rudder ?? controls.yaw ?? 0, -1, 1)
    const flap = clamp(controls.flaps ?? flightState.flaps ?? 0, 0, 1)
    const verticalSpeed = flightState.verticalSpeed ?? 0
    const speed = Math.abs(
      flightState.speed ??
        flightState.airspeed ??
        flightState.groundSpeed ??
        (typeof flightState.velocity === 'number'
          ? flightState.velocity
          : (flightState.velocity?.y ?? 0)),
    )

    this.propellerAngle = (this.propellerAngle + delta * throttle * 78) % (Math.PI * 2)
    this.propeller.rotation.z = this.propellerAngle
    this.propellerBlur.material.opacity = damp(
      this.propellerBlur.material.opacity,
      throttle * 0.085,
      7,
      delta,
    )

    this.leftAileron.rotation.x = damp(
      this.leftAileron.rotation.x,
      aileron * 0.5,
      10,
      delta,
    )
    this.rightAileron.rotation.x = damp(
      this.rightAileron.rotation.x,
      -aileron * 0.5,
      10,
      delta,
    )
    this.leftFlap.rotation.x = damp(this.leftFlap.rotation.x, flap * 0.72, 7, delta)
    this.rightFlap.rotation.x = damp(this.rightFlap.rotation.x, flap * 0.72, 7, delta)
    this.leftElevator.rotation.x = damp(
      this.leftElevator.rotation.x,
      -elevator * 0.44,
      9,
      delta,
    )
    this.rightElevator.rotation.x = damp(
      this.rightElevator.rotation.x,
      -elevator * 0.44,
      9,
      delta,
    )
    this.rudder.rotation.y = damp(this.rudder.rotation.y, rudder * 0.48, 9, delta)

    const targetCompression = clamp(
      flightState.wheelCompression ??
        (flightState.grounded ? 0.48 + verticalSpeed * 0.035 : 0),
      0,
      1,
    )
    this.compression = damp(this.compression, targetCompression, 11, delta)
    this.airframe.position.y = -this.compression * 0.15
    this.updateLandingStruts()

    this.wheelAngle -= (speed / 0.46) * delta
    this.mainWheels[0].rotation.x = this.wheelAngle
    this.mainWheels[1].rotation.x = this.wheelAngle
    this.noseWheel.rotation.x = this.wheelAngle * 1.35

    this.cabinLight.intensity = running
      ? 0.46 + Math.sin(time * 1.7) * 0.025
      : 0.34
    this.cabinGlowMaterial.emissiveIntensity = running ? 0.48 : 0.28
    this.redLightMaterial.emissiveIntensity = 1.85 + Math.sin(time * 2.4) * 0.22
    this.greenLightMaterial.emissiveIntensity = 1.85 + Math.sin(time * 2.4 + 0.7) * 0.22
    this.whiteLightMaterial.emissiveIntensity = 1.55 + Math.sin(time * 2.1 + 1.3) * 0.12
    this.redLight.intensity = 0.62 + Math.sin(time * 2.4) * 0.08
    this.greenLight.intensity = 0.62 + Math.sin(time * 2.4 + 0.7) * 0.08
    this.whiteLight.intensity = 0.38 + Math.sin(time * 2.1 + 1.3) * 0.04

    this.updateExhaust(delta, throttle, running)
  }

  private updateLandingStruts(): void {
    for (const strut of this.landingStruts) {
      this.strutAnchor.copy(strut.anchor)
      this.strutAnchor.y += this.airframe.position.y
      setRodBetween(strut.mesh, this.strutAnchor, strut.axle)
    }
  }

  private updateExhaust(delta: number, throttle: number, running: boolean): void {
    if (!this.exhaustEnabled) return

    this.exhaustTimer -= delta
    if (running && throttle > 0.35 && this.exhaustTimer <= 0) {
      const puff = this.exhaustPuffs[this.exhaustCursor]
      if (puff) {
        this.exhaustCursor = (this.exhaustCursor + 1) % this.exhaustPuffs.length
        puff.age = 0
        puff.life = lerp(0.7, 1.15, throttle)
        puff.strength = lerp(0.055, 0.15, throttle)
        puff.drift.set(
          0.08 + Math.random() * 0.08,
          0.11 + Math.random() * 0.09,
          lerp(3.4, 7.2, throttle),
        )
        puff.mesh.position.set(0.5, -0.48, -2.18)
        puff.mesh.scale.setScalar(0.72)
        puff.mesh.material.opacity = puff.strength
        puff.mesh.visible = true
      }
      this.exhaustTimer = lerp(0.48, 0.26, throttle) + Math.random() * 0.1
    }

    for (const puff of this.exhaustPuffs) {
      if (!puff.mesh.visible) continue
      puff.age += delta
      const progress = puff.age / puff.life
      if (progress >= 1) {
        puff.mesh.visible = false
        puff.mesh.material.opacity = 0
        continue
      }
      puff.mesh.position.addScaledVector(puff.drift, delta)
      puff.mesh.scale.setScalar(lerp(0.72, 2.15, progress))
      puff.mesh.material.opacity =
        puff.strength * Math.pow(1 - progress, 1.35) * (0.82 + throttle * 0.18)
    }
  }
}
