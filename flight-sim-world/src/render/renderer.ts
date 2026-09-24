import * as THREE from 'three'

export type Quality = 'high' | 'low'

export type QualityRenderer = THREE.WebGLRenderer & {
  quality: Quality
  setQuality: (quality: Quality) => void
  resize: () => void
}

const viewportSize = (container: HTMLElement): { width: number; height: number } => {
  const bounds = container.getBoundingClientRect?.()
  const fallbackWidth = typeof window === 'undefined' ? 1280 : window.innerWidth
  const fallbackHeight = typeof window === 'undefined' ? 720 : window.innerHeight
  return {
    width: Math.max(1, Math.floor(container.clientWidth || bounds?.width || fallbackWidth || 1280)),
    height: Math.max(1, Math.floor(container.clientHeight || bounds?.height || fallbackHeight || 720)),
  }
}

export const createRenderer = (container: HTMLElement): QualityRenderer => {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = true
  renderer.setClearColor(0x21162f, 1)
  renderer.domElement.setAttribute('aria-label', 'Windward flight view')
  container.appendChild(renderer.domElement)

  let quality: Quality = 'high'
  let resizeObserver: ResizeObserver | null = null

  const resize = (): void => {
    const { width, height } = viewportSize(container)
    renderer.setSize(width, height, false)
  }

  const setQuality = (nextQuality: Quality): void => {
    quality = nextQuality === 'low' ? 'low' : 'high'
    ;(renderer as QualityRenderer).quality = quality
    const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
    renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.5 : 1))
    resize()
  }

  const qualityRenderer = renderer as QualityRenderer
  qualityRenderer.quality = quality
  qualityRenderer.resize = resize
  qualityRenderer.setQuality = setQuality

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', resize)
  }

  setQuality('high')

  const originalDispose = renderer.dispose.bind(renderer)
  qualityRenderer.dispose = (): void => {
    resizeObserver?.disconnect()
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', resize)
    }
    originalDispose()
  }

  return qualityRenderer
}
