import * as THREE from 'three'
import {
  FLIGHT,
  TIME_OF_DAY_AUTO_CYCLE_SECONDS,
  TIME_OF_DAY_PRESETS,
  TIME_OF_DAY_TRANSITION_SECONDS,
  mixTimeOfDayPreset,
  type TimeOfDayName,
  type TimeOfDayPreset,
} from './core/config'
import { clamp, smoothstep } from './core/math'
import { AircraftVisual } from './entities/aircraft'
import { createRenderer, type Quality } from './render/renderer'
import { AudioSystem } from './systems/audio'
import { CameraMode, CameraRig } from './systems/cameraRig'
import {
  FlightModel,
  type FlightControls,
  type FlightEvent,
  type ResolvedFlightControls,
} from './systems/flightModel'
import {
  advanceThrottle,
  InputManager,
  isEditableTarget,
  type MutableInputState,
  type OrbitDelta,
} from './systems/input'
import { Objectives } from './systems/objectives'
import { Hud, type CameraMode as HudCameraMode, type MessageTone } from './ui/hud'
import { Sky } from './world/sky'
import { World } from './world/world'

const requiredElement = <ElementType extends HTMLElement>(selector: string): ElementType => {
  const element = document.querySelector<ElementType>(selector)
  if (element === null) throw new Error(`Missing required element: ${selector}`)
  return element
}

const nextPaint = (): Promise<void> => new Promise((resolve) => {
  window.requestAnimationFrame(() => resolve())
})

const cameraHudMode = (mode: CameraMode): HudCameraMode => {
  if (mode === CameraMode.NearChase) return 'nearChase'
  return mode
}

const cameraMode = (mode: HudCameraMode): CameraMode => {
  if (mode === 'nearChase') return CameraMode.NearChase
  if (mode === 'cockpit') return CameraMode.Cockpit
  if (mode === 'orbit') return CameraMode.Orbit
  return CameraMode.Chase
}

const MAX_VISUAL_FRAME_TIME = 0.25

const timeOfDayPreset = (name: TimeOfDayName): TimeOfDayPreset => {
  const preset = TIME_OF_DAY_PRESETS.find((entry) => entry.name === name)
  if (preset === undefined) throw new Error(`Missing time-of-day preset: ${name}`)
  return preset
}

const locationName = (region: string, position: THREE.Vector3): string => {
  if (position.y > 390 || region === 'Open Sky') return 'Open Sky'
  if (region === 'The Home Field') return 'Airfield'
  if (region === 'Coastal Bluffs') return 'Amber Bay'
  if (region === 'Mountain Spine') return 'The High Pass'
  if (region === 'River Valley') return 'Lantern River'
  if (region.endsWith(' Town')) return region.slice(0, -5)
  return region
}

const worldLabelsFor = (
  world: World,
  camera: THREE.PerspectiveCamera,
  position: THREE.Vector3,
  projected: THREE.Vector3,
) => world.getVisibleLandmarks(position).flatMap((landmark) => {
  projected.set(...landmark.position).project(camera)
  if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1.08 || Math.abs(projected.y) > 1.08) return []
  const labelPosition = new THREE.Vector3(...landmark.position)
  return [{
    name: landmark.name,
    x: (projected.x * 0.5 + 0.5) * 100,
    y: (-projected.y * 0.5 + 0.5) * 100,
    distance: position.distanceTo(labelPosition),
    kind: 'landmark',
  }]
}).sort((left, right) => left.distance - right.distance).slice(0, 4)

const eventMessage = (event: FlightEvent): { text: string; tone: MessageTone; duration: number } => {
  switch (event.type) {
    case 'takeoff':
      return { text: 'Wings free — the coast is yours.', tone: 'status', duration: 1900 }
    case 'touchdown':
      return { text: 'Wheels down. Bring it to a stop.', tone: 'status', duration: 2200 }
    case 'bounce':
      return { text: 'A firm bounce — ease the descent.', tone: 'warning', duration: 2300 }
    case 'cleanLanding':
      return { text: 'A clean landing. Lovely flying.', tone: 'status', duration: 2600 }
    case 'crash':
      return {
        text: event.reason === 'water'
          ? 'Water contact — returning to Windward.'
          : event.reason === 'outOfBounds'
            ? 'Beyond the charted coast — returning to Windward.'
            : 'Hard landing — returning to Windward.',
        tone: 'danger',
        duration: 2800,
      }
    case 'stallEnter':
      return { text: 'Stall — lower the nose and add power.', tone: 'warning', duration: 2200 }
    case 'stallExit':
      return { text: 'Lift restored.', tone: 'status', duration: 1200 }
  }
}

async function bootstrap(): Promise<void> {
  const sceneRoot = requiredElement<HTMLElement>('#scene')
  const uiRoot = requiredElement<HTMLElement>('#ui-root')
  const loading = requiredElement<HTMLElement>('#loading')
  const loadingStatus = requiredElement<HTMLElement>('#loading-status')

  loadingStatus.textContent = 'Polishing the instruments…'
  await nextPaint()

  const renderer = createRenderer(sceneRoot)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(57, 1, 0.08, 14000)
  const sky = new Sky(scene)

  loadingStatus.textContent = 'Raising the islands and lighthouses…'
  await nextPaint()

  const world = new World(scene)
  const flight = new FlightModel()
  const aircraft = new AircraftVisual(scene, { exhaust: true })
  const cameraRig = new CameraRig(camera, CameraMode.Chase)
  const objectives = new Objectives()
  const audio = new AudioSystem({ autoUnlock: true })
  let quality: Quality = 'high'
  let throttleLevel = 0
  let flaps = 0
  let started = false
  let paused = false
  let recovering = false
  let recoveryEndsAt = 0
  let transientMessage: { text: string; tone: MessageTone; until: number } | null = null
  let previousThrottleUp = false
  let previousBoost = false
  let previousBrakes = false
  let takeoffRollPlayed = false
  let suppressBoostForTimeChord = false
  let timeOfDay: TimeOfDayName = 'dusk'
  let timeTransitionFrom = timeOfDayPreset('dusk')
  let timeTransitionTo = timeTransitionFrom
  let timeTransitionElapsed = TIME_OF_DAY_TRANSITION_SECONDS
  let timeOfDayDirty = true
  let autoTimeCycle = false
  let autoTimeCycleElapsed = 0

  const setAutoTimeCycle = (enabled: boolean): void => {
    autoTimeCycle = enabled
    autoTimeCycleElapsed = 0
  }

  const cycleTimeOfDay = (direction: -1 | 1): void => {
    const transitionProgress = clamp(timeTransitionElapsed / TIME_OF_DAY_TRANSITION_SECONDS, 0, 1)
    const currentPreset = mixTimeOfDayPreset(
      timeTransitionFrom,
      timeTransitionTo,
      smoothstep(0, 1, transitionProgress),
    )
    const currentIndex = TIME_OF_DAY_PRESETS.findIndex((preset) => preset.name === timeOfDay)
    const wrappedIndex = (currentIndex + direction + TIME_OF_DAY_PRESETS.length) % TIME_OF_DAY_PRESETS.length
    const nextName = TIME_OF_DAY_PRESETS[wrappedIndex]?.name ?? 'dusk'
    timeTransitionFrom = currentPreset
    timeTransitionTo = timeOfDayPreset(nextName)
    timeTransitionElapsed = 0
    timeOfDayDirty = true
    autoTimeCycleElapsed = 0
    timeOfDay = nextName
    hud.update({ timeOfDay })
  }

  const updateTimeOfDay = (delta: number): void => {
    if (timeTransitionElapsed < TIME_OF_DAY_TRANSITION_SECONDS) {
      timeTransitionElapsed = Math.min(TIME_OF_DAY_TRANSITION_SECONDS, timeTransitionElapsed + delta)
      timeOfDayDirty = true
      if (timeTransitionElapsed >= TIME_OF_DAY_TRANSITION_SECONDS) timeTransitionFrom = timeTransitionTo
    } else if (autoTimeCycle) {
      autoTimeCycleElapsed += delta
      if (autoTimeCycleElapsed >= TIME_OF_DAY_AUTO_CYCLE_SECONDS) cycleTimeOfDay(1)
    }
    if (!timeOfDayDirty) return
    const amount = smoothstep(0, 1, clamp(timeTransitionElapsed / TIME_OF_DAY_TRANSITION_SECONDS, 0, 1))
    const visual = mixTimeOfDayPreset(timeTransitionFrom, timeTransitionTo, amount)
    sky.applyTimeOfDay(timeTransitionFrom, timeTransitionTo, amount)
    world.applyTimeOfDay(timeTransitionFrom, timeTransitionTo, amount)
    renderer.toneMappingExposure = visual.exposure
    renderer.setClearColor(visual.backgroundColor, 1)
    timeOfDayDirty = false
  }

  const setPaused = (nextPaused: boolean): void => {
    if (recovering) return
    paused = started && nextPaused
    input.reset()
    input.setEnabled(started)
    hud.update({ paused, grounded: flight.state.grounded, heldKeys: [] })
    if (paused) void audio.suspend()
    else void audio.unlock()
  }

  const resetFlight = (snapCamera = true): void => {
    recovering = false
    flight.reset()
    objectives.reset()
    throttleLevel = 0
    flaps = 0
    previousThrottleUp = false
    previousBoost = false
    previousBrakes = false
    takeoffRollPlayed = false
    suppressBoostForTimeChord = false
    flight.writeInterpolatedPose(aircraft.root.position, aircraft.root.quaternion, 1)
    cameraRig.reset(snapCamera)
    input.reset()
    transientMessage = null
    hud.clearMessage()
    if (started) {
      paused = false
      input.setEnabled(true)
      hud.update({ paused: false, grounded: true, heldKeys: [] })
      void audio.unlock()
    }
    audio.update({
      throttle: flight.state.throttle,
      airspeed: flight.state.airspeed,
      grounded: flight.state.grounded,
      verticalSpeed: flight.state.verticalSpeed,
      wind: 5.5,
    })
  }

  const applyQuality = (nextQuality: Quality): void => {
    quality = nextQuality
    renderer.setQuality(quality)
    renderer.shadowMap.enabled = quality === 'high'
  }

  const cycleCamera = (): void => {
    cameraRig.next()
    cameraRig.snap()
    hud.setCameraMode(cameraHudMode(cameraRig.mode))
    audio.cameraClick()
  }

  const input = new InputManager({
    target: sceneRoot,
    keyboardTarget: window,
    onAction: (action, event) => {
      if (action === 'mute') {
        audio.toggleMute()
        hud.update({ muted: audio.muted })
        return
      }
      if (action === 'reset') {
        resetFlight()
        return
      }
      if (!started || recovering) return
      if (action === 'pause') {
        setPaused(!paused)
      } else if (action === 'camera') {
        cycleCamera()
      } else if (action === 'flaps') {
        flaps = flaps > 0.5 ? 0 : 1
      } else if (action === 'timeOfDay') {
        if (event.shiftKey) suppressBoostForTimeChord = true
        cycleTimeOfDay(event.shiftKey ? -1 : 1)
      }
    },
  })
  input.setEnabled(false)

  const startFlight = (): void => {
    if (started) return
    started = true
    paused = false
    input.setEnabled(true)
    void audio.unlock()
    hud.update({ paused: false, showIntro: false })
  }

  const hud = new Hud(uiRoot, {
    title: 'Windward',
    onBegin: startFlight,
    onPause: (nextPaused) => {
      if (!recovering) setPaused(nextPaused)
    },
    onReset: () => resetFlight(),
     onCameraMode: (mode) => {
       cameraRig.setMode(cameraMode(mode))
       cameraRig.snap()
     },

    onQualityChange: (nextQuality) => applyQuality(nextQuality),
    onMuteToggle: (muted) => {
      audio.setMuted(muted)
      hud.update({ muted: audio.muted })
    },
    onAutoTimeCycleChange: setAutoTimeCycle,
  })
  const onBeginKeyDown = (event: KeyboardEvent): void => {
    const target = event.target instanceof Element ? event.target : null
    const uiControl = target?.closest('button, input, select, textarea, a, [role="button"], [data-ui]') ?? null
    if (event.defaultPrevented || event.repeat || started || recovering || event.key !== 'Enter' || isEditableTarget(target) || uiControl !== null) return
    event.preventDefault()
    hud.begin()
  }
  window.addEventListener('keydown', onBeginKeyDown)
  hud.update({
    region: 'The Home Field',
    location: 'Airfield',
    cameraMode: cameraHudMode(cameraRig.mode),
    graphicsQuality: quality,
    muted: audio.muted,
    timeOfDay,
    autoTimeCycle,
     grounded: flight.state.grounded,
     heldKeys: input.getState().heldKeys,
     crashed: flight.state.crashed,
     objectives: objectives.snapshots,

    showIntro: true,
  })
  audio.update({
    throttle: flight.state.throttle,
    airspeed: flight.state.airspeed,
    grounded: flight.state.grounded,
    verticalSpeed: flight.state.verticalSpeed,
    wind: 5.5,
  })

  const resize = (): void => {
    const width = Math.max(1, sceneRoot.clientWidth)
    const height = Math.max(1, sceneRoot.clientHeight)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.resize()
  }
  window.addEventListener('resize', resize)
  resize()
  applyQuality('high')
  updateTimeOfDay(0)

  flight.writeInterpolatedPose(aircraft.root.position, aircraft.root.quaternion, 1)
  cameraRig.update(1, aircraft.root, true, {})
  sky.update(camera, 0)
  world.update(0, camera.position)
  renderer.render(scene, camera)

  let previousTime = performance.now() * 0.001
  let simulationTime = 0
  let hudAccumulator = 1
  let animationFrame = 0
  const projected = new THREE.Vector3()
  const inputState: MutableInputState = {
    pitch: 0,
    roll: 0,
    yaw: 0,
    throttle: 0,
    throttleDelta: 0,
    throttleAxis: 0,
    boost: false,
    reverse: 0,
    brakes: 0,
    brake: false,
    mousePitch: 0,
    mouseRoll: 0,
    aim: { pitch: 0, roll: 0 },
    heldKeys: [],
    heldKeyCodes: [],
    orbitDelta: { x: 0, y: 0, zoom: 0 },
  }
  const orbitDelta: OrbitDelta = { x: 0, y: 0, zoom: 0 }
  const activeControls: FlightControls = {
    throttle: 0,
    throttleInput: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    brakes: false,
    reverse: false,
    boost: false,
    pitchActive: false,
    rollActive: false,
    yawActive: false,
    flaps: 0,
  }
  const visualControls: ResolvedFlightControls = {
    throttle: 0,
    throttleInput: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    brakes: 0,
    reverse: false,
    boost: false,
    pitchActive: false,
    rollActive: false,
    yawActive: false,
    flaps: 0,
  }
  const renderState = {
    position: aircraft.root.position,
    quaternion: aircraft.root.quaternion,
    velocity: flight.velocity,
    grounded: flight.state.grounded,
  }

  const frame = (timestamp: number): void => {
    const now = timestamp * 0.001
    const elapsed = Math.max(0, now - previousTime)
    const delta = clamp(elapsed, 0, FLIGHT.maxFrameTime)
    const visualDelta = clamp(elapsed, 0, MAX_VISUAL_FRAME_TIME)
    previousTime = now
    if (recovering && now >= recoveryEndsAt) resetFlight()
    updateTimeOfDay(visualDelta)
    input.updateInto(visualDelta, inputState)
    if (started && !paused && !recovering) {
      const shiftHeld = inputState.heldKeyCodes.includes('ShiftLeft') || inputState.heldKeyCodes.includes('ShiftRight')
      if (suppressBoostForTimeChord && !shiftHeld) suppressBoostForTimeChord = false
      const boost = inputState.boost && !suppressBoostForTimeChord
      throttleLevel = advanceThrottle(throttleLevel, inputState.throttleDelta, visualDelta, boost)
      const throttleUp = inputState.throttleDelta > 0
      if (throttleUp && !previousThrottleUp) audio.throttleSurge()
      if (boost && !previousBoost) audio.throttleSurge()
      if (inputState.brakes > 0 && !previousBrakes && flight.state.grounded) audio.brake()
      previousThrottleUp = throttleUp
      previousBoost = boost
      previousBrakes = inputState.brakes > 0

      activeControls.throttle = boost ? 1 : throttleLevel
      activeControls.throttleInput = inputState.throttleDelta
      activeControls.pitch = inputState.pitch
      activeControls.roll = inputState.roll
      activeControls.yaw = inputState.yaw
      activeControls.brakes = inputState.brakes
      activeControls.reverse = inputState.reverse > 0
      activeControls.boost = boost
      activeControls.pitchActive = Math.abs(inputState.pitch) > 0.01
      activeControls.rollActive = Math.abs(inputState.roll) > 0.01
      activeControls.yawActive = Math.abs(inputState.yaw) > 0.01
      activeControls.flaps = flaps

      const forwardPower = throttleUp || boost
      if (!takeoffRollPlayed && flight.state.grounded && forwardPower && flight.state.groundSpeed > 1) {
        audio.takeoffRoll()
        takeoffRollPlayed = true
      }

      const event: FlightEvent | null = flight.step(delta, activeControls)
      simulationTime += visualDelta
      objectives.update(delta, flight.state, event)

      if (event !== null) {
        const message = eventMessage(event)
        transientMessage = { ...message, until: now + message.duration * 0.001 }
        if (event.type === 'takeoff') audio.liftoff()
        if (event.type === 'touchdown' || event.type === 'bounce') {
          takeoffRollPlayed = false
          audio.touchdown(clamp((event.impactSpeed ?? 4) / 8, 0.25, 1))
        }
        if (event.type === 'cleanLanding') takeoffRollPlayed = false
        if (event.type === 'crash') {
          if (event.reason === 'water') audio.waterHit()
          else audio.crash()
          recovering = true
          recoveryEndsAt = now + 1.05
          input.reset()
          activeControls.throttle = 0
          activeControls.throttleInput = 0
          activeControls.pitch = 0
          activeControls.roll = 0
          activeControls.yaw = 0
          activeControls.brakes = false
          activeControls.reverse = false
          activeControls.boost = false
          activeControls.pitchActive = false
          activeControls.rollActive = false
          activeControls.yawActive = false
          activeControls.flaps = 0
          audio.update({
            throttle: 0,
            airspeed: 0,
            grounded: true,
            verticalSpeed: 0,
            wind: 5.5,
          })
        }
      }
      audio.update({
        throttle: flight.state.throttle,
        airspeed: flight.state.airspeed,
        grounded: flight.state.grounded,
        verticalSpeed: flight.state.verticalSpeed,
        wind: 5.5,
      })
    }

    flight.writeInterpolatedPose(aircraft.root.position, aircraft.root.quaternion)
    aircraft.setCockpitMode(cameraRig.mode === CameraMode.Cockpit)
    aircraft.update(simulationTime, flight.state, flight.writeControlState(visualControls))
    input.consumeOrbitDeltaInto(orbitDelta)
    renderState.grounded = flight.state.grounded
    cameraRig.update(visualDelta, renderState, flight.state.grounded, orbitDelta)
    sky.update(camera, simulationTime)
    world.update(simulationTime, camera.position)

    hudAccumulator += visualDelta
    if (hudAccumulator >= 0.08) {
      hudAccumulator = 0
      const region = world.getRegionAt(flight.state.position)
      const currentMessage = transientMessage !== null && now < transientMessage.until ? transientMessage : null
      hud.update({
        region,
        location: locationName(region, flight.state.position),
        airspeed: flight.state.airspeed * 1.94384,
        altitude: Math.max(0, flight.state.altitude),
        headingRadians: flight.state.heading,
        throttle: flight.state.throttle,
        pitchRadians: flight.state.pitch,
        rollRadians: flight.state.roll,
        yaw: flight.state.heading,
        angleUnit: 'radians',
        wind: { speed: 5.5, direction: 248, label: '5.5 KT' },
        objectives: objectives.snapshots,
        worldLabels: worldLabelsFor(world, camera, flight.state.position, projected),
        paused,
         cameraMode: cameraHudMode(cameraRig.mode),
         graphicsQuality: quality,
         muted: audio.muted,
         timeOfDay,
         autoTimeCycle,
         grounded: flight.state.grounded,
         heldKeys: inputState.heldKeys,
         crashed: flight.state.crashed,
         showIntro: !started,

         stalled: currentMessage === null && flight.state.stalled,

        ...(currentMessage === null ? {} : { message: currentMessage.text, messageTone: currentMessage.tone }),
      })
    }

    input.clearActions()
    renderer.render(scene, camera)
    animationFrame = window.requestAnimationFrame(frame)
  }

  loadingStatus.textContent = 'The evening wind is ready.'
  await nextPaint()
  loading.classList.add('is-hidden')
  window.setTimeout(() => {
    loading.hidden = true
  }, 500)
  animationFrame = window.requestAnimationFrame(frame)

  window.addEventListener('beforeunload', () => {
    window.cancelAnimationFrame(animationFrame)
    input.dispose()
    audio.dispose()
    hud.dispose()
    aircraft.dispose()
    world.dispose()
    sky.dispose()
    renderer.dispose()
    window.removeEventListener('resize', resize)
    window.removeEventListener('keydown', onBeginKeyDown)
  }, { once: true })
}

void bootstrap().catch((error: unknown) => {
  const loadingStatus = document.querySelector<HTMLElement>('#loading-status')
  if (loadingStatus !== null) loadingStatus.textContent = 'The atlas could not open. Please reload in a WebGL browser.'
  console.error(error)
})
