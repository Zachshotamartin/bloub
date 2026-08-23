// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import { KumoLogoElement } from './kumo-logo'

afterEach(() => document.body.replaceChildren())

describe('<kumo-logo>', () => {
  it('renders one borderless body, four independently articulated legs, and two eyes', () => {
    const kumo = document.createElement('kumo-logo') as KumoLogoElement
    document.body.append(kumo)
    kumo.configure({
      color: '#e8483f',
      expression: 'curious',
      design: {
        bodyAspect: 0.4,
        legStyle: 'knuckle',
        eyeColor: '#315ea8',
        legs: [
          { angle: -170, reach: 0.8, bend: -0.8 },
          { angle: -12, reach: 1.2, bend: 0.7 },
          { angle: 54, reach: 0.9, bend: -0.5 },
          { angle: 128, reach: 1.1, bend: 0.6 }
        ]
      },
      motion: { amount: 0.9, speed: 1.4, rhythm: 'skitter' },
      followPointer: true
    })

    expect(kumo.shadowRoot?.querySelectorAll('[data-kumo-leg]')).toHaveLength(4)
    expect(kumo.shadowRoot?.querySelectorAll('[data-kumo-eye]')).toHaveLength(2)
    expect(kumo.shadowRoot?.querySelector('[data-kumo-body]')?.getAttribute('stroke')).toBeNull()
    for (const leg of kumo.shadowRoot?.querySelectorAll('[data-kumo-leg] path') ?? []) {
      expect(leg.getAttribute('stroke')).toBe('none')
    }

    expect(kumo.getConfig()).toMatchObject({
      color: '#e8483f',
      expression: 'curieux',
      context: 'idle',
      followPointer: true,
      design: { bodyAspect: 0.4, legStyle: 'knuckle', eyeColor: '#315ea8' },
      motion: { amount: 0.9, speed: 1.4, rhythm: 'skitter' }
    })
  })

  it('exposes situational contexts, gaze, expressions, and immediate signature breaks', () => {
    const kumo = document.createElement('kumo-logo') as KumoLogoElement
    document.body.append(kumo)

    expect(kumo.setExpression('happy')).toBe(true)
    expect(kumo.setExpression('not-an-expression')).toBe(false)
    expect(kumo.setContext('loading')).toBe(true)
    expect(kumo.getConfig().context).toBe('loading')
    expect(kumo.playBreak('curl')).toBe(true)
    expect(kumo.playBreak('not-a-break')).toBe(false)
    expect(kumo.lookAt(20, -20)).toBe(kumo)
    expect(kumo.resumeIdle()).toBe(kumo)
    expect(kumo.getConfig().context).toBe('idle')
  })

  it('accepts configuration through the public property as well as configure()', () => {
    const kumo = document.createElement('kumo-logo') as KumoLogoElement
    document.body.append(kumo)
    kumo.config = {
      color: '#b84d3e',
      design: { legLength: 1.3, eyeColor: '#f9f9f9' },
      motion: { speed: 2 }
    }
    expect(kumo.config).toMatchObject({
      color: '#b84d3e',
      design: { legLength: 1.3, eyeColor: '#f9f9f9' },
      motion: { speed: 2 }
    })
    kumo.setAttribute('expression', 'happy')
    expect(kumo.getConfig().expression).toBe('heureux')
  })

  it('exposes authored states, rainbow startup, sequences, and cancellation as promises', async () => {
    const kumo = document.createElement('kumo-logo') as KumoLogoElement
    document.body.append(kumo)
    const starts: string[] = []
    kumo.addEventListener('kumo-animation-start', (event) => {
      starts.push((event as CustomEvent<{ name: string }>).detail.name)
    })

    const startup = kumo.playAnimation('startup')
    expect(starts).toEqual(['startup'])
    expect(kumo.stopAnimation()).toBe(kumo)
    await expect(startup).resolves.toBe(false)
    await expect(kumo.playAnimation('not-a-studio-state')).resolves.toBe(false)
    await expect(kumo.playSequence([])).resolves.toBe(true)
  })
})
