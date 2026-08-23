import { describe, expect, it } from 'vitest'
import { normalizeKumoDesign, normalizeKumoMotion } from '@/bot/kumo'
import { KUMO_EMBED_MODULE, kumoEmbedSnippet } from './embed'

describe('interactive Kumo embed export', () => {
  it('serializes every authored design and motion setting into the copied component', () => {
    const design = normalizeKumoDesign({
      bodyAspect: 0.72,
      legLength: 1.24,
      legThickness: 0.81,
      legStyle: 'knuckle',
      eyeColor: '#315ea8',
      legs: [
        { angle: -171, reach: 0.75, bend: -0.91 },
        { angle: -16, reach: 1.31, bend: 0.73 },
        { angle: 58, reach: 0.88, bend: -0.42 },
        { angle: 133, reach: 1.12, bend: 0.64 }
      ]
    })
    const motion = normalizeKumoMotion({ amount: 0.84, speed: 1.67, rhythm: 'skitter' })
    const snippet = kumoEmbedSnippet({
      color: '#E8483F',
      expression: 'curieux',
      design,
      motion
    })

    expect(snippet).toContain(`<kumo-logo id="kumo-logo"`)
    expect(snippet).toContain(`import "${KUMO_EMBED_MODULE}"`)
    expect(snippet).toContain('kumo.configure({')
    expect(snippet).toContain('"color": "#e8483f"')
    expect(snippet).toContain('"expression": "curieux"')
    expect(snippet).toContain('"legStyle": "knuckle"')
    expect(snippet).toContain('"eyeColor": "#315ea8"')
    expect(snippet).toContain('"angle": -171')
    expect(snippet).toContain('"amount": 0.84')
    expect(snippet).toContain('"speed": 1.67')
    expect(snippet).toContain('"rhythm": "skitter"')
    expect(snippet).toContain('await kumo.playAnimation("startup")')
    expect(snippet).toContain('kumo.playSequence(["wink", "play", "comet"])')
    expect(snippet).toContain('kumo.getConfig()')
  })

  it('normalizes unsafe input and cannot terminate its own script block', () => {
    const snippet = kumoEmbedSnippet({
      color: '</script>',
      expression: '</script>',
      design: normalizeKumoDesign({ bodyAspect: 20 }),
      motion: normalizeKumoMotion({ amount: -5 })
    })
    expect(snippet.match(/<\/script>/g)).toHaveLength(1)
    expect(snippet).toContain('"color": "#d9d9d9"')
    expect(snippet).toContain('"expression": "neutre"')
    expect(snippet).toContain('"bodyAspect": 1')
    expect(snippet).toContain('"amount": 0')
  })
})
