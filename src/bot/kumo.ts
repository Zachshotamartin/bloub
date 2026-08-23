import { clamp, loopNoise, r2 } from './math'

export const KUMO_LEG_STYLE_IDS = ['silk', 'petal', 'knuckle'] as const
export type KumoLegStyle = (typeof KUMO_LEG_STYLE_IDS)[number]
export const KUMO_MOTION_RHYTHM_IDS = ['flow', 'breathe', 'skitter', 'doze'] as const
export type KumoMotionRhythm = (typeof KUMO_MOTION_RHYTHM_IDS)[number]

/** One movable leg handle. Angle is measured around the body in SVG degrees. */
export interface KumoAttachment {
  angle: number
  reach: number
  bend: number
}

/** The rendered organic path plus the geometry needed by motion and export. */
export interface KumoLegGeometry extends KumoAttachment {
  d: string
  pivotX: number
  pivotY: number
  tipX: number
  tipY: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** User-controlled silhouette parameters. Values are deliberately normalized. */
export interface KumoDesign {
  /** -1 = taller body, 0 = round, 1 = wider body. */
  bodyAspect: number
  legLength: number
  legThickness: number
  legStyle: KumoLegStyle
  /** Four independently placeable handles around the body. */
  legs: KumoAttachment[]
}

/** Autonomous leg movement, driven by the same looped noise used by the eyes. */
export interface KumoMotion {
  amount: number
  speed: number
  rhythm: KumoMotionRhythm
}

export const DEFAULT_KUMO_LEGS: readonly KumoAttachment[] = [
  { angle: -148, reach: 0.94, bend: -0.62 },
  { angle: -32, reach: 1.08, bend: 0.5 },
  { angle: 30, reach: 0.92, bend: -0.58 },
  { angle: 150, reach: 1.04, bend: 0.54 }
]

export interface KumoStance {
  id: 'scout' | 'pounce' | 'orbit' | 'bloom'
  legs: readonly KumoAttachment[]
}

/** Distinct starting gestures, not small variations of one fixed silhouette. */
export const KUMO_STANCES: readonly KumoStance[] = [
  { id: 'scout', legs: DEFAULT_KUMO_LEGS },
  {
    id: 'pounce',
    legs: [
      { angle: -164, reach: 0.78, bend: -0.62 },
      { angle: -20, reach: 1.28, bend: 0.5 },
      { angle: 24, reach: 1.2, bend: -0.38 },
      { angle: 158, reach: 0.82, bend: 0.58 }
    ]
  },
  {
    id: 'orbit',
    legs: [
      { angle: -132, reach: 1, bend: -0.18 },
      { angle: -42, reach: 1, bend: -0.18 },
      { angle: 48, reach: 1, bend: -0.18 },
      { angle: 138, reach: 1, bend: -0.18 }
    ]
  },
  {
    id: 'bloom',
    legs: [
      { angle: -108, reach: 1.1, bend: 0.68 },
      { angle: -18, reach: 0.9, bend: 0.68 },
      { angle: 72, reach: 1.1, bend: 0.68 },
      { angle: 162, reach: 0.9, bend: 0.68 }
    ]
  }
]

export const DEFAULT_KUMO_DESIGN: KumoDesign = {
  bodyAspect: 0,
  legLength: 1,
  legThickness: 1,
  legStyle: 'silk',
  legs: DEFAULT_KUMO_LEGS.map((leg) => ({ ...leg }))
}

export const DEFAULT_KUMO_MOTION: KumoMotion = {
  amount: 0.55,
  speed: 1,
  rhythm: 'breathe'
}

const finite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function wrapKumoAngle(value: number) {
  return ((((finite(value, 0) + 180) % 360) + 360) % 360) - 180
}

export function normalizeKumoLeg(
  value: Partial<KumoAttachment> = {},
  fallback: KumoAttachment = DEFAULT_KUMO_LEGS[0]!
): KumoAttachment {
  return {
    angle: wrapKumoAngle(finite(value.angle, fallback.angle)),
    reach: clamp(finite(value.reach, fallback.reach), 0.65, 1.35),
    bend: clamp(finite(value.bend, fallback.bend), -1, 1)
  }
}

type StoredKumoDesign = Partial<KumoDesign> & { legSpread?: number }

export function normalizeKumoDesign(value: StoredKumoDesign = {}): KumoDesign {
  const legacySpread = clamp(finite(value.legSpread, 0), -1, 1)
  const legacyDirections = [-1, 1, 1, -1]
  const sourceLegs = Array.isArray(value.legs) ? value.legs : []
  const legs = DEFAULT_KUMO_LEGS.map((fallback, index) => {
    const migrated = {
      ...fallback,
      angle: fallback.angle + (legacyDirections[index] ?? 0) * legacySpread * 15
    }
    return normalizeKumoLeg(sourceLegs[index], migrated)
  })
  const legStyle = KUMO_LEG_STYLE_IDS.includes(value.legStyle as KumoLegStyle)
    ? (value.legStyle as KumoLegStyle)
    : DEFAULT_KUMO_DESIGN.legStyle

  return {
    bodyAspect: clamp(finite(value.bodyAspect, DEFAULT_KUMO_DESIGN.bodyAspect), -1, 1),
    legLength: clamp(finite(value.legLength, DEFAULT_KUMO_DESIGN.legLength), 0.72, 1.3),
    legThickness: clamp(
      finite(value.legThickness, DEFAULT_KUMO_DESIGN.legThickness),
      0.65,
      1.35
    ),
    legStyle,
    legs
  }
}

export function normalizeKumoMotion(value: Partial<KumoMotion> = {}): KumoMotion {
  const rhythm = KUMO_MOTION_RHYTHM_IDS.includes(value.rhythm as KumoMotionRhythm)
    ? (value.rhythm as KumoMotionRhythm)
    : DEFAULT_KUMO_MOTION.rhythm
  return {
    amount: clamp(finite(value.amount, DEFAULT_KUMO_MOTION.amount), 0, 1),
    speed: clamp(finite(value.speed, DEFAULT_KUMO_MOTION.speed), 0.35, 2),
    rhythm
  }
}

/** Safely restores a persisted object; old spread-only designs are migrated. */
export function parseKumoDesign(raw: string | null): KumoDesign {
  if (!raw) return normalizeKumoDesign(DEFAULT_KUMO_DESIGN)
  try {
    return normalizeKumoDesign(JSON.parse(raw) as StoredKumoDesign)
  } catch {
    return normalizeKumoDesign(DEFAULT_KUMO_DESIGN)
  }
}

export function parseKumoMotion(raw: string | null): KumoMotion {
  if (!raw) return { ...DEFAULT_KUMO_MOTION }
  try {
    return normalizeKumoMotion(JSON.parse(raw) as Partial<KumoMotion>)
  } catch {
    return { ...DEFAULT_KUMO_MOTION }
  }
}

export function kumoBodyAxes(value: KumoDesign) {
  const design = normalizeKumoDesign(value)
  return {
    sx: 1 + design.bodyAspect * 0.14,
    sy: 1 - design.bodyAspect * 0.11
  }
}

/** Turns the round base profile into an editable ellipse. */
export function designKumoBody(base: number[], value: KumoDesign): number[] {
  const { sx, sy } = kumoBodyAxes(value)
  return base.map((radius, i) => {
    const angle = (i / base.length) * Math.PI * 2
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    return radius / Math.sqrt((c * c) / (sx * sx) + (s * s) / (sy * sy))
  })
}

interface Point {
  x: number
  y: number
}

const point = (x: number, y: number): Point => ({ x, y })
const add = (a: Point, b: Point) => point(a.x + b.x, a.y + b.y)
const scale = (a: Point, amount: number) => point(a.x * amount, a.y * amount)
const mix = (a: Point, b: Point, amount: number) =>
  point(a.x + (b.x - a.x) * amount, a.y + (b.y - a.y) * amount)
const unit = (a: Point) => {
  const length = Math.max(0.0001, Math.hypot(a.x, a.y))
  return point(a.x / length, a.y / length)
}
const normal = (a: Point) => point(-a.y, a.x)
const pathPoint = (a: Point) => `${r2(a.x)} ${r2(a.y)}`

const STYLE_METRICS: Record<
  KumoLegStyle,
  { root: number; elbow: number; tip: number; curl: number; cap: number }
> = {
  /** Fine at the tip, like a brush stroke growing out of the body. */
  silk: { root: 0.14, elbow: 0.11, tip: 0.055, curl: 1, cap: 1.35 },
  /** A soft, buoyant lobe with a deliberately generous middle. */
  petal: { root: 0.105, elbow: 0.155, tip: 0.145, curl: 0.78, cap: 1.2 },
  /** A round elbow that narrows into a small foot, without a hard corner. */
  knuckle: { root: 0.09, elbow: 0.205, tip: 0.085, curl: 1.12, cap: 1.48 }
}

/**
 * Builds four filled Bezier limbs. Their roots sit under the body, so the body
 * hides the seam while the tapered tips remain expressive and logo-like.
 */
export function designKumoAttachments(
  base: readonly KumoAttachment[],
  value: KumoDesign
): KumoLegGeometry[] {
  const design = normalizeKumoDesign(value)
  const { sx, sy } = kumoBodyAxes(design)
  const metrics = STYLE_METRICS[design.legStyle]

  return DEFAULT_KUMO_LEGS.map((fallback, index) => {
    const authored = design.legs[index] ?? base[index] ?? fallback
    const leg = normalizeKumoLeg(authored, base[index] ?? fallback)
    const angle = (leg.angle * Math.PI) / 180
    const radial = point(Math.cos(angle), Math.sin(angle))
    const tangent = normal(radial)
    const edge =
      1 / Math.sqrt((radial.x * radial.x) / (sx * sx) + (radial.y * radial.y) / (sy * sy))
    const root = scale(radial, edge * 0.74)
    const length = 0.56 * design.legLength * leg.reach
    const curl = leg.bend * length * 0.52 * metrics.curl
    const elbow = add(add(root, scale(radial, length * 0.52)), scale(tangent, curl))
    const tip = add(add(root, scale(radial, length)), scale(tangent, curl * 0.34))

    const firstDirection = unit(point(elbow.x - root.x, elbow.y - root.y))
    const secondDirection = unit(point(tip.x - elbow.x, tip.y - elbow.y))
    const middleDirection = unit(add(firstDirection, secondDirection))
    const rootNormal = normal(firstDirection)
    const elbowNormal = normal(middleDirection)
    const tipNormal = normal(secondDirection)
    const thickness = design.legThickness
    const rootWidth = metrics.root * thickness
    const elbowWidth = metrics.elbow * thickness
    const tipWidth = metrics.tip * thickness

    const rootLeft = add(root, scale(rootNormal, rootWidth))
    const rootRight = add(root, scale(rootNormal, -rootWidth))
    const elbowLeft = add(elbow, scale(elbowNormal, elbowWidth))
    const elbowRight = add(elbow, scale(elbowNormal, -elbowWidth))
    const tipLeft = add(tip, scale(tipNormal, tipWidth))
    const tipRight = add(tip, scale(tipNormal, -tipWidth))
    const firstControl = add(mix(root, elbow, 0.5), scale(tangent, curl * 0.12))
    const secondControl = add(mix(elbow, tip, 0.5), scale(tangent, curl * 0.08))
    const firstControlLeft = add(firstControl, scale(rootNormal, elbowWidth))
    const firstControlRight = add(firstControl, scale(rootNormal, -elbowWidth))
    const secondControlLeft = add(secondControl, scale(tipNormal, elbowWidth))
    const secondControlRight = add(secondControl, scale(tipNormal, -elbowWidth))
    const capReach = tipWidth * metrics.cap
    const capLeft = add(tipLeft, scale(secondDirection, capReach))
    const capRight = add(tipRight, scale(secondDirection, capReach))
    const outline = [
      rootLeft,
      firstControlLeft,
      elbowLeft,
      secondControlLeft,
      tipLeft,
      capLeft,
      capRight,
      tipRight,
      secondControlRight,
      elbowRight,
      firstControlRight,
      rootRight
    ]

    const sides = [
      `C ${pathPoint(firstControlLeft)} ${pathPoint(secondControlLeft)} ${pathPoint(tipLeft)}`,
      `C ${pathPoint(capLeft)} ${pathPoint(capRight)} ${pathPoint(tipRight)}`,
      `C ${pathPoint(secondControlRight)} ${pathPoint(firstControlRight)} ${pathPoint(rootRight)}`
    ]

    return {
      ...leg,
      d: [`M ${pathPoint(rootLeft)}`, ...sides, 'Z'].join(' '),
      pivotX: root.x,
      pivotY: root.y,
      tipX: tip.x,
      tipY: tip.y,
      minX: Math.min(...outline.map((p) => p.x)),
      minY: Math.min(...outline.map((p) => p.y)),
      maxX: Math.max(...outline.map((p) => p.x)),
      maxY: Math.max(...outline.map((p) => p.y))
    }
  })
}

export interface KumoLegMotionPose {
  rotation: number
  reach: number
}

const smoothstep = (value: number) => {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

/** A soft deterministic gate that creates intentional breaks between gestures. */
export function kumoMotionEnvelope(time: number, rhythm: KumoMotionRhythm) {
  if (rhythm === 'flow') return 1
  const windows: Record<Exclude<KumoMotionRhythm, 'flow'>, [number, number, number]> = {
    breathe: [4, 2.3, 0.35],
    skitter: [2.2, 0.55, 0.12],
    doze: [5.8, 1.45, 0.3]
  }
  const [period, active, fade] = windows[rhythm]
  const phase = ((Math.max(0, finite(time, 0)) % period) + period) % period
  if (phase <= active) return 1
  if (phase < active + fade) return 1 - smoothstep((phase - active) / fade)
  if (phase > period - fade) return smoothstep((phase - (period - fade)) / fade)
  return 0
}

/**
 * Deterministic organic motion for one leg. Like eye liveliness, this is a pure
 * function of time made from several incommensurate loop-noise periods.
 */
export function kumoLegMotionAt(
  time: number,
  index: number,
  value: KumoMotion
): KumoLegMotionPose {
  const motion = normalizeKumoMotion(value)
  if (motion.amount === 0) return { rotation: 0, reach: 0 }
  const t = Math.max(0, finite(time, 0)) * motion.speed
  const seed = [0.35, 2.15, 4.3, 5.85][index] ?? index * 1.7
  const broad = loopNoise(t, 3.1 + index * 0.23, seed)
  const detail = loopNoise(t, 1.7 + index * 0.17, seed + 1.9)
  const envelope = kumoMotionEnvelope(t, motion.rhythm)
  return {
    rotation: (broad * 13 + detail * 3.5) * motion.amount * envelope,
    reach:
      loopNoise(t, 4.2 + index * 0.19, seed + 3.2) * 0.035 * motion.amount * envelope
  }
}

/** SVG transform applied around the leg's hidden shoulder joint. */
export function kumoLegTransform(
  attachment: KumoLegGeometry,
  index: number,
  time: number,
  value: KumoMotion,
  scaleFactor: number
): string {
  const pose = kumoLegMotionAt(time, index, value)
  const distance = Math.max(0.001, Math.hypot(attachment.pivotX, attachment.pivotY))
  const ux = attachment.pivotX / distance
  const uy = attachment.pivotY / distance
  const pivotX = attachment.pivotX * scaleFactor
  const pivotY = attachment.pivotY * scaleFactor
  return `translate(${r2(ux * pose.reach * scaleFactor)} ${r2(uy * pose.reach * scaleFactor)}) rotate(${r2(pose.rotation)} ${r2(pivotX)} ${r2(pivotY)})`
}
