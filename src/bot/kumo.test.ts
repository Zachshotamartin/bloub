import { describe, expect, it } from 'vitest'
import { SHAPE_BY_ID } from './skins'
import {
  DEFAULT_KUMO_DESIGN,
  designKumoAttachments,
  designKumoBody,
  kumoLegMotionAt,
  kumoLegTransform,
  normalizeKumoDesign,
  parseKumoDesign,
  parseKumoMotion
} from './kumo'

const kumo = SHAPE_BY_ID.get('kumo')!

describe('configurable Kumo silhouette', () => {
  it('keeps exactly four editable legs for every design', () => {
    const legs = designKumoAttachments(kumo.attachments!, {
      bodyAspect: 0.8,
      legLength: 1.15,
      legThickness: 0.72,
      legSpread: 1
    })
    expect(legs).toHaveLength(4)
    expect(legs.every((leg) => Object.values(leg).every(Number.isFinite))).toBe(true)
  })

  it('changes both the body profile and leg geometry', () => {
    const round = designKumoBody(kumo.radii, DEFAULT_KUMO_DESIGN)
    const wide = designKumoBody(kumo.radii, { ...DEFAULT_KUMO_DESIGN, bodyAspect: 1 })
    expect(wide[0]).toBeGreaterThan(round[0]!)
    expect(wide[Math.floor(wide.length / 4)]).toBeLessThan(round[Math.floor(round.length / 4)]!)

    const short = designKumoAttachments(kumo.attachments!, {
      ...DEFAULT_KUMO_DESIGN,
      legLength: 0.75
    })
    const long = designKumoAttachments(kumo.attachments!, {
      ...DEFAULT_KUMO_DESIGN,
      legLength: 1.15
    })
    expect(Math.max(long[0]!.rx, long[0]!.ry)).toBeGreaterThan(
      Math.max(short[0]!.rx, short[0]!.ry)
    )
  })

  it('clamps and safely restores persisted settings', () => {
    expect(normalizeKumoDesign({ bodyAspect: 50, legLength: -4 })).toMatchObject({
      bodyAspect: 1,
      legLength: 0.75
    })
    expect(parseKumoDesign('{bad json')).toEqual(DEFAULT_KUMO_DESIGN)
    expect(parseKumoMotion('{"amount":9,"speed":0}')).toEqual({ amount: 1, speed: 0.35 })
  })
})

describe('Kumo leg movement', () => {
  it('is deterministic, independent per leg, and disabled at zero amount', () => {
    const motion = { amount: 0.8, speed: 1.2 }
    expect(kumoLegMotionAt(2.4, 0, motion)).toEqual(kumoLegMotionAt(2.4, 0, motion))
    expect(kumoLegMotionAt(2.4, 0, motion)).not.toEqual(kumoLegMotionAt(2.4, 1, motion))
    expect(kumoLegMotionAt(2.4, 0, { amount: 0, speed: 2 })).toEqual({
      rotation: 0,
      reach: 0
    })
  })

  it('emits a finite SVG transform around the inner joint', () => {
    const leg = designKumoAttachments(kumo.attachments!, DEFAULT_KUMO_DESIGN)[0]!
    expect(kumoLegTransform(leg, 0, 1.25, { amount: 1, speed: 1 }, 100)).toMatch(
      /^translate\(-?[\d.]+ -?[\d.]+\) rotate\(-?[\d.]+ -?[\d.]+ -?[\d.]+\)$/
    )
  })
})
