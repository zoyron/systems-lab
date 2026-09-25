import { expect, test, type Page } from '@playwright/test'

const debugText = async (page: Page, selector: string): Promise<string> =>
  (await page.locator(selector).textContent())?.trim() ?? ''

test('uses the flight toy controls, state-coupled instruments, audio preference, and recovery', async ({ page }, testInfo) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.locator('#loading')).toBeHidden({ timeout: 30_000 })
  await expect(page.locator('#scene canvas')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Windward' })).toBeVisible()
  await expect(page.locator('[data-begin-card]')).toBeVisible()
  await expect(page.locator('[data-debug-overlay]')).toBeVisible()

  const webgl = await page.locator('#scene canvas').evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement
    const context = element.getContext('webgl2') ?? element.getContext('webgl')
    return { available: context !== null, width: element.width, height: element.height }
  })
  expect(webgl.available).toBe(true)
  expect(webgl.width).toBeGreaterThan(0)
  expect(webgl.height).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath('windward-first-load.png') })

  await page.keyboard.press('Enter')
  await expect(page.locator('[data-begin-card]')).toBeHidden()
  await expect(page.locator('[data-debug-muted]')).toHaveText('false')
  await expect(page.locator('[data-debug-grounded]')).toHaveText('true')
  await page.keyboard.down('w')
  await page.waitForTimeout(600)
  await expect(page.locator('[data-debug-pitch]')).toHaveText('+0°')
  await expect(page.locator('[data-debug-throttle]')).not.toHaveText('0%')
  await page.keyboard.up('w')
  await page.screenshot({ path: testInfo.outputPath('windward-airfield.png') })

  await page.keyboard.down('Shift')
  await page.keyboard.down('w')
  await page.waitForTimeout(10_500)
  await page.keyboard.up('Shift')
  await page.waitForTimeout(1_200)
  await page.keyboard.up('w')
  await page.waitForTimeout(900)

  const throttle = await debugText(page, '[data-debug-throttle]')
  const airspeed = Number.parseFloat(await page.locator('[data-airspeed]').textContent() ?? '0')
  const altitude = Number.parseFloat(await page.locator('[data-altitude]').textContent() ?? '0')
  expect(Number.parseFloat(throttle)).toBeGreaterThan(50)
  expect(airspeed).toBeGreaterThan(45)
  expect(altitude).toBeGreaterThan(30)
  await expect(page.locator('[data-debug-grounded]')).toHaveText('false')
  await expect(page.locator('[data-debug-held-keys]')).toHaveText('none')

  await page.keyboard.down('ArrowDown')
  await page.waitForTimeout(900)
  await page.keyboard.up('ArrowDown')
  await page.waitForTimeout(500)
  await expect(page.locator('[data-debug-pitch]')).not.toHaveText('+0°')
  await page.screenshot({ path: testInfo.outputPath('windward-cruise.png') })

  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(700)
  await page.keyboard.up('ArrowRight')
  await page.waitForTimeout(250)
  const roll = await debugText(page, '[data-debug-roll]')
  expect(Number.parseFloat(roll)).toBeGreaterThan(5)

  await page.keyboard.press('c')
  await expect(page.locator('#camera-mode')).toHaveValue('nearChase')
  await page.keyboard.press('c')
  await expect(page.locator('#camera-mode')).toHaveValue('cockpit')
  await page.waitForTimeout(500)
  await page.screenshot({ path: testInfo.outputPath('windward-cockpit.png') })
  await page.keyboard.press('c')
  await expect(page.locator('#camera-mode')).toHaveValue('orbit')
  await page.keyboard.press('c')
  await expect(page.locator('#camera-mode')).toHaveValue('chase')

  await page.keyboard.press('p')
  await expect(page.locator('[data-pause-banner]')).toBeVisible()
  await page.keyboard.press('p')
  await expect(page.locator('[data-pause-banner]')).toBeHidden()

  await page.keyboard.press('m')
  await expect(page.locator('[data-debug-muted]')).toHaveText('true')
  await page.reload()
  await expect(page.locator('#loading')).toBeHidden({ timeout: 30_000 })
  await expect(page.locator('[data-debug-muted]')).toHaveText('true')
  await page.locator('[data-hud-action="begin"]').click()
  await page.keyboard.press('r')
  await page.waitForTimeout(500)
  const resetAltitude = Number.parseFloat(await page.locator('[data-altitude]').textContent() ?? '0')
  expect(resetAltitude).toBeGreaterThan(20)
  expect(resetAltitude).toBeLessThan(40)
  expect(runtimeErrors).toEqual([])
})
