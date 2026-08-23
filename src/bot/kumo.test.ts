import { describe, expect, it } from 'vitest'
import { SHAPE_BY_ID } from './skins'
import {
  DEFAULT_KUMO_DESIGN,
  designKumoAttachments,
  designKumoBody,
  kumoLegMotionAt,
  kumoLegPathAt,
  kumoLegTransform,
  kumoSignatureBreakAt,
  normalizeKumoDesign,
  parseKumoDesign,
  parseKumoMotion
} from './kumo'

const kumo = SHAPE_BY_ID.get('kumo')!
const extent = (leg: ReturnType<typeof designKumoAttachments>[number]) =>
  Math.max(Math.abs(leg.minX), Math.abs(leg.maxX), Math.abs(leg.minY), Math.abs(leg.maxY))

describe('configurable Kumo silhouette', () => {
  it('builds exactly four finite, editable filled-vector legs', () => {
    const legs = designKumoAttachments(
      kumo.attachments!,
      normalizeKumoDesign({
        bodyAspect: 0.8,
        legLength: 1.25,
        legThickness: 0.7,
        legStyle: 'paddle'
      })
    )
    expect(legs).toHaveLength(4)
    expect(legs.every((leg) => leg.d.startsWith('M ') && leg.d.endsWith(' Z'))).toBe(true)
    expect(
      legs.every((leg) =>
        [leg.pivotX, leg.pivotY, leg.tipX, leg.tipY, leg.minX, leg.minY, leg.maxX, leg.maxY].every(
          Number.isFinite
        )
      )
    ).toBe(true)
  })

  it('changes the body, total reach, and limb language independently', () => {
    const round = designKumoBody(kumo.radii, DEFAULT_KUMO_DESIGN)
    const wideDesign = normalizeKumoDesign({ ...DEFAULT_KUMO_DESIGN, bodyAspect: 1 })
    const wide = designKumoBody(kumo.radii, wideDesign)
    expect(wide[0]).toBeGreaterThan(round[0]!)
    expect(wide[Math.floor(wide.length / 4)]).toBeLessThan(round[Math.floor(round.length / 4)]!)

    const short = designKumoAttachments(
      kumo.attachments!,
      normalizeKumoDesign({ ...DEFAULT_KUMO_DESIGN, legLength: 0.72 })
    )
    const long = designKumoAttachments(
      kumo.attachments!,
      normalizeKumoDesign({ ...DEFAULT_KUMO_DESIGN, legLength: 1.3 })
    )
    expect(extent(long[0]!)).toBeGreaterThan(extent(short[0]!))

    const taper = designKumoAttachments(kumo.attachments!, DEFAULT_KUMO_DESIGN)
    const paddle = designKumoAttachments(
      kumo.attachments!,
      normalizeKumoDesign({ ...DEFAULT_KUMO_DESIGN, legStyle: 'paddle' })
    )
    const knuckle = designKumoAttachments(
      kumo.attachments!,
      normalizeKumoDesign({ ...DEFAULT_KUMO_DESIGN, legStyle: 'knuckle' })
    )
    expect(new Set([taper[0]!.d, paddle[0]!.d, knuckle[0]!.d]).size).toBe(3)
    expect(taper[0]!.d).not.toMatch(/ [LQ] /)
    expect(paddle[0]!.d).not.toMatch(/ [LQ] /)
    expect(knuckle[0]!.d).toMatch(/ L .+ C .+ L .+ C .+ L .+ C .+ L /)
    expect(knuckle[0]!.d).not.toContain(' Q ')
    expect(knuckle[0]!.knuckle).toBeDefined()
    expect([knuckle[0]!.jointX, knuckle[0]!.jointY].every(Number.isFinite)).toBe(true)
  })

  it('moves one leg around the body without moving the other three', () => {
    const movedDesign = normalizeKumoDesign({
      ...DEFAULT_KUMO_DESIGN,
      legs: DEFAULT_KUMO_DESIGN.legs.map((leg, index) =>
        index === 1 ? { ...leg, angle: 92, reach: 1.3, bend: -0.8 } : { ...leg }
      )
    })
    const original = designKumoAttachments(kumo.attachments!, DEFAULT_KUMO_DESIGN)
    const moved = designKumoAttachments(kumo.attachments!, movedDesign)
    expect(moved[1]!.tipY).toBeGreaterThan(0)
    expect(moved[1]!.d).not.toBe(original[1]!.d)
    expect(moved[0]!.d).toBe(original[0]!.d)
    expect(moved[2]!.d).toBe(original[2]!.d)
    expect(moved[3]!.d).toBe(original[3]!.d)
  })

  it('clamps, migrates, and safely restores persisted settings', () => {
    const normalized = normalizeKumoDesign({
      bodyAspect: 50,
      legLength: -4,
      legStyle: 'not-real' as never,
      legs: [{ angle: 725, reach: 9, bend: -8 }]
    })
    expect(normalized).toMatchObject({
      bodyAspect: 1,
      legLength: 0.72,
      legStyle: 'taper',
      eyeColor: DEFAULT_KUMO_DESIGN.eyeColor
    })
    expect(normalized.legs[0]).toEqual({ angle: 5, reach: 1.35, bend: -1 })
    expect(normalizeKumoDesign({ legStyle: 'silk' }).legStyle).toBe('taper')
    expect(normalizeKumoDesign({ legStyle: 'petal' }).legStyle).toBe('paddle')
    expect(normalizeKumoDesign({ eyeColor: '#B84D3E' }).eyeColor).toBe('#b84d3e')
    expect(normalizeKumoDesign({ eyeColor: 'red' }).eyeColor).toBe(DEFAULT_KUMO_DESIGN.eyeColor)
    expect(parseKumoDesign('{bad json')).toEqual(DEFAULT_KUMO_DESIGN)
    expect(parseKumoDesign('{"legSpread":1}').legs[0]!.angle).not.toBe(
      DEFAULT_KUMO_DESIGN.legs[0]!.angle
    )
    expect(parseKumoMotion('{"amount":9,"speed":0}')).toEqual({
      amount: 1,
      speed: 0.35,
      rhythm: 'breathe'
    })
  })
})

describe('Kumo leg movement', () => {
  it('is deterministic, independent per leg, and disabled at zero amount', () => {
    const motion = { amount: 0.8, speed: 1.2, rhythm: 'flow' as const }
    expect(kumoLegMotionAt(2.4, 0, motion)).toEqual(kumoLegMotionAt(2.4, 0, motion))
    expect(kumoLegMotionAt(2.4, 0, motion)).not.toEqual(kumoLegMotionAt(2.4, 1, motion))
    expect(kumoLegMotionAt(2.4, 0, { amount: 0, speed: 2, rhythm: 'doze' })).toEqual({
      rotation: 0,
      jointRotation: 0,
      reach: 0
    })
    expect(kumoLegMotionAt(2.4, 0, motion).reach).toBe(0)
    expect(Math.abs(kumoLegMotionAt(2.4, 0, motion).rotation)).toBeLessThan(6)
  })

  it('crossfades into three distinct signature gestures instead of stopping', () => {
    expect(kumoSignatureBreakAt(50, 0, 'flow')).toEqual({
      mix: 0,
      rotation: 0,
      jointRotation: 0
    })
    const samples = [
      kumoSignatureBreakAt(3.925, 0, 'breathe'),
      kumoSignatureBreakAt(2.43, 0, 'skitter'),
      kumoSignatureBreakAt(4.925, 0, 'doze')
    ]
    expect(samples.every((pose) => pose.mix > 0.9)).toBe(true)
    expect(new Set(samples.map((pose) => `${pose.rotation.toFixed(2)}/${pose.jointRotation.toFixed(2)}`)).size).toBe(3)
    expect(kumoSignatureBreakAt(0.5, 0, 'breathe').mix).toBe(0)

    const timings = { breathe: 3.925, skitter: 2.43, doze: 4.925 } as const
    for (const rhythm of ['breathe', 'skitter', 'doze'] as const) {
      const movement = Array.from({ length: 4 }, (_, index) =>
        kumoLegMotionAt(timings[rhythm], index, { amount: 1, speed: 1, rhythm })
      )
      expect(
        movement.reduce(
          (sum, pose) => sum + Math.abs(pose.rotation) + Math.abs(pose.jointRotation),
          0
        )
      ).toBeGreaterThan(8)
    }
  })

  it('emits a finite SVG transform around the hidden shoulder', () => {
    const leg = designKumoAttachments(kumo.attachments!, DEFAULT_KUMO_DESIGN)[0]!
    const transform = kumoLegTransform(
      leg,
      0,
      1.25,
      { amount: 1, speed: 1, rhythm: 'flow' },
      100
    )
    expect(transform).toMatch(
      /^translate\(-?[\d.]+ -?[\d.]+\) rotate\(-?[\d.]+ -?[\d.]+ -?[\d.]+\)$/
    )
    expect(transform).toMatch(/^translate\(0 0\)/)
  })

  it('animates every shoulder and every Knuckle elbow', () => {
    const motion = { amount: 1, speed: 1.1, rhythm: 'flow' as const }
    const knuckles = designKumoAttachments(
      kumo.attachments!,
      normalizeKumoDesign({ legStyle: 'knuckle' })
    )
    for (let index = 0; index < 4; index++) {
      const before = kumoLegMotionAt(0.2, index, motion)
      const after = kumoLegMotionAt(0.9, index, motion)
      expect(after.rotation).not.toBe(before.rotation)
      expect(after.jointRotation).not.toBe(before.jointRotation)
      expect(after.reach).toBe(0)
      expect(kumoLegPathAt(knuckles[index]!, index, 0.9, motion)).not.toBe(
        kumoLegPathAt(knuckles[index]!, index, 0.2, motion)
      )
      expect(kumoLegPathAt(knuckles[index]!, index, 1, { ...motion, amount: 0 })).toBe(
        knuckles[index]!.d
      )
    }
  })
})
