import { clamp, loopNoise, r2 } from './math'

export const KUMO_LEG_STYLE_IDS = ['taper', 'paddle', 'knuckle'] as const
export type KumoLegStyle = (typeof KUMO_LEG_STYLE_IDS)[number]
export const KUMO_MOTION_RHYTHM_IDS = ['flow', 'breathe', 'skitter', 'doze'] as const
export type KumoMotionRhythm = (typeof KUMO_MOTION_RHYTHM_IDS)[number]

export const KUMO_EYE_COLORS = [
  { id: 'ink', hex: '#111318' },
  { id: 'paper', hex: '#f9f9f9' },
  { id: 'cobalt', hex: '#315ea8' },
  { id: 'ember', hex: '#b84d3e' },
  { id: 'moss', hex: '#4f765d' },
  { id: 'violet', hex: '#735f91' },
  { id: 'amber', hex: '#b87a2e' }
] as const

/** One movable leg handle. Angle is measured around the body in SVG degrees. */
export interface KumoAttachment {
  angle: number
  reach: number
  bend: number
}

interface KumoKnuckleRig {
  root: Point
  elbow: Point
  tip: Point
  thickness: number
}

/** The rendered organic path plus the geometry needed by motion and export. */
export interface KumoLegGeometry extends KumoAttachment {
  d: string
  /** Source points used to rebuild one continuous path while its elbow flexes. */
  knuckle?: KumoKnuckleRig
  pivotX: number
  pivotY: number
  jointX: number
  jointY: number
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
  eyeColor: string
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
  legStyle: 'taper',
  eyeColor: KUMO_EYE_COLORS[0].hex,
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

type StoredKumoDesign = Omit<Partial<KumoDesign>, 'legStyle'> & {
  legStyle?: KumoLegStyle | 'silk' | 'petal'
  legSpread?: number
}

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
  const legacyStyles: Record<string, KumoLegStyle> = {
    silk: 'taper',
    petal: 'paddle'
  }
  const storedStyle = typeof value.legStyle === 'string' ? value.legStyle : ''
  const legStyle = KUMO_LEG_STYLE_IDS.includes(storedStyle as KumoLegStyle)
    ? (storedStyle as KumoLegStyle)
    : (legacyStyles[storedStyle] ?? DEFAULT_KUMO_DESIGN.legStyle)
  const eyeColor =
    typeof value.eyeColor === 'string' && /^#[0-9a-f]{6}$/i.test(value.eyeColor)
      ? value.eyeColor.toLowerCase()
      : DEFAULT_KUMO_DESIGN.eyeColor

  return {
    bodyAspect: clamp(finite(value.bodyAspect, DEFAULT_KUMO_DESIGN.bodyAspect), -1, 1),
    legLength: clamp(finite(value.legLength, DEFAULT_KUMO_DESIGN.legLength), 0.72, 1.3),
    legThickness: clamp(
      finite(value.legThickness, DEFAULT_KUMO_DESIGN.legThickness),
      0.65,
      1.35
    ),
    legStyle,
    eyeColor,
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

interface LegPath {
  d: string
  outline: Point[]
}

/** One uninterrupted limb that visibly narrows from shoulder to tip. */
function taperedLegPath(root: Point, elbow: Point, tip: Point, thickness: number): LegPath {
  return smoothLegPath(root, elbow, tip, {
    root: 0.135 * thickness,
    middle: 0.092 * thickness,
    tip: 0.042 * thickness
  })
}

/** A narrow stem that deliberately widens into a broad rounded paddle. */
function paddleLegPath(root: Point, elbow: Point, tip: Point, thickness: number): LegPath {
  return smoothLegPath(root, elbow, tip, {
    root: 0.078 * thickness,
    middle: 0.094 * thickness,
    tip: 0.17 * thickness
  })
}

function smoothLegPath(
  root: Point,
  elbow: Point,
  tip: Point,
  width: { root: number; middle: number; tip: number }
): LegPath {
  const firstDirection = unit(point(elbow.x - root.x, elbow.y - root.y))
  const secondDirection = unit(point(tip.x - elbow.x, tip.y - elbow.y))
  const rootNormal = normal(firstDirection)
  const tipNormal = normal(secondDirection)
  const rootLeft = add(root, scale(rootNormal, width.root))
  const rootRight = add(root, scale(rootNormal, -width.root))
  const tipLeft = add(tip, scale(tipNormal, width.tip))
  const tipRight = add(tip, scale(tipNormal, -width.tip))
  const firstControl = mix(root, elbow, 0.82)
  const secondControl = mix(elbow, tip, 0.18)
  const firstControlLeft = add(firstControl, scale(rootNormal, width.middle))
  const firstControlRight = add(firstControl, scale(rootNormal, -width.middle))
  const secondControlLeft = add(secondControl, scale(tipNormal, width.middle))
  const secondControlRight = add(secondControl, scale(tipNormal, -width.middle))
  const cap = width.tip * 1.34
  const capLeft = add(tipLeft, scale(secondDirection, cap))
  const capRight = add(tipRight, scale(secondDirection, cap))
  const outline = [
    rootLeft,
    firstControlLeft,
    secondControlLeft,
    tipLeft,
    capLeft,
    capRight,
    tipRight,
    secondControlRight,
    firstControlRight,
    rootRight
  ]
  return {
    d: [
      `M ${pathPoint(rootLeft)}`,
      `C ${pathPoint(firstControlLeft)} ${pathPoint(secondControlLeft)} ${pathPoint(tipLeft)}`,
      `C ${pathPoint(capLeft)} ${pathPoint(capRight)} ${pathPoint(tipRight)}`,
      `C ${pathPoint(secondControlRight)} ${pathPoint(firstControlRight)} ${pathPoint(rootRight)}`,
      'Z'
    ].join(' '),
    outline
  }
}

/** Two straight bones joined by one tangent-continuous rounded elbow. */
function knuckleLegPath(root: Point, elbow: Point, tip: Point, thickness: number): LegPath {
  const firstDirection = unit(point(elbow.x - root.x, elbow.y - root.y))
  const secondDirection = unit(point(tip.x - elbow.x, tip.y - elbow.y))
  const firstNormal = normal(firstDirection)
  const secondNormal = normal(secondDirection)
  const rootWidth = 0.105 * thickness
  const jointWidth = 0.09 * thickness
  const tipWidth = 0.055 * thickness
  const corner = jointWidth * 1.55
  const handle = corner * 0.78
  const rootLeft = add(root, scale(firstNormal, rootWidth))
  const rootRight = add(root, scale(firstNormal, -rootWidth))
  const firstJointLeft = add(
    add(elbow, scale(firstNormal, jointWidth)),
    scale(firstDirection, -corner)
  )
  const secondJointLeft = add(
    add(elbow, scale(secondNormal, jointWidth)),
    scale(secondDirection, corner)
  )
  const outerControlA = add(firstJointLeft, scale(firstDirection, handle))
  const outerControlB = add(secondJointLeft, scale(secondDirection, -handle))
  const secondJointRight = add(
    add(elbow, scale(secondNormal, -jointWidth)),
    scale(secondDirection, corner)
  )
  const firstJointRight = add(
    add(elbow, scale(firstNormal, -jointWidth)),
    scale(firstDirection, -corner)
  )
  const innerControlA = add(secondJointRight, scale(secondDirection, -handle))
  const innerControlB = add(firstJointRight, scale(firstDirection, handle))
  const tipLeft = add(tip, scale(secondNormal, tipWidth))
  const tipRight = add(tip, scale(secondNormal, -tipWidth))
  const capLeft = add(tipLeft, scale(secondDirection, tipWidth * 1.34))
  const capRight = add(tipRight, scale(secondDirection, tipWidth * 1.34))
  const outline = [
    rootLeft,
    firstJointLeft,
    outerControlA,
    outerControlB,
    secondJointLeft,
    tipLeft,
    capLeft,
    capRight,
    tipRight,
    secondJointRight,
    innerControlA,
    innerControlB,
    firstJointRight,
    rootRight
  ]
  return {
    d: [
      `M ${pathPoint(rootLeft)}`,
      `L ${pathPoint(firstJointLeft)}`,
      `C ${pathPoint(outerControlA)} ${pathPoint(outerControlB)} ${pathPoint(secondJointLeft)}`,
      `L ${pathPoint(tipLeft)}`,
      `C ${pathPoint(capLeft)} ${pathPoint(capRight)} ${pathPoint(tipRight)}`,
      `L ${pathPoint(secondJointRight)}`,
      `C ${pathPoint(innerControlA)} ${pathPoint(innerControlB)} ${pathPoint(firstJointRight)}`,
      `L ${pathPoint(rootRight)}`,
      'Z'
    ].join(' '),
    outline
  }
}

/**
 * Builds four filled limbs. Each family's name describes its construction, and
 * every root extends deep beneath the body so animation cannot expose the seam.
 */
export function designKumoAttachments(
  base: readonly KumoAttachment[],
  value: KumoDesign
): KumoLegGeometry[] {
  const design = normalizeKumoDesign(value)
  const { sx, sy } = kumoBodyAxes(design)

  return DEFAULT_KUMO_LEGS.map((fallback, index) => {
    const authored = design.legs[index] ?? base[index] ?? fallback
    const leg = normalizeKumoLeg(authored, base[index] ?? fallback)
    const angle = (leg.angle * Math.PI) / 180
    const radial = point(Math.cos(angle), Math.sin(angle))
    const tangent = normal(radial)
    const edge =
      1 / Math.sqrt((radial.x * radial.x) / (sx * sx) + (radial.y * radial.y) / (sy * sy))
    const root = scale(radial, edge * 0.38)
    const shoulder = scale(radial, edge * 0.68)
    const length = 0.56 * design.legLength * leg.reach
    const bend = leg.bend * length
    const elbow = add(
      add(shoulder, scale(radial, length * 0.5)),
      scale(tangent, bend * (design.legStyle === 'knuckle' ? 0.42 : 0.32))
    )
    const tip = add(add(shoulder, scale(radial, length)), scale(tangent, bend * 0.08))
    const geometry =
      design.legStyle === 'taper'
        ? taperedLegPath(root, elbow, tip, design.legThickness)
        : design.legStyle === 'paddle'
          ? paddleLegPath(root, elbow, tip, design.legThickness)
          : knuckleLegPath(root, elbow, tip, design.legThickness)

    return {
      ...leg,
      d: geometry.d,
      knuckle:
        design.legStyle === 'knuckle'
          ? { root, elbow, tip, thickness: design.legThickness }
          : undefined,
      pivotX: shoulder.x,
      pivotY: shoulder.y,
      jointX: elbow.x,
      jointY: elbow.y,
      tipX: tip.x,
      tipY: tip.y,
      minX: Math.min(...geometry.outline.map((p) => p.x)),
      minY: Math.min(...geometry.outline.map((p) => p.y)),
      maxX: Math.max(...geometry.outline.map((p) => p.x)),
      maxY: Math.max(...geometry.outline.map((p) => p.y))
    }
  })
}

export interface KumoLegMotionPose {
  rotation: number
  jointRotation: number
  reach: number
}

const smoothstep = (value: number) => {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

export interface KumoSignatureBreakPose {
  mix: number
  rotation: number
  jointRotation: number
}

const BREAK_WINDOWS: Record<
  Exclude<KumoMotionRhythm, 'flow'>,
  { period: number; start: number; duration: number }
> = {
  breathe: { period: 5.2, start: 3.15, duration: 1.55 },
  skitter: { period: 3.8, start: 1.95, duration: 1.15 },
  doze: { period: 6.6, start: 3.85, duration: 2.15 }
}

/**
 * A rare signature gesture layered over the ordinary idle. A break is never a
 * stop: `mix` crossfades from baseline motion into a different choreography.
 */
export function kumoSignatureBreakAt(
  time: number,
  index: number,
  rhythm: KumoMotionRhythm
): KumoSignatureBreakPose {
  if (rhythm === 'flow') return { mix: 0, rotation: 0, jointRotation: 0 }
  const { period, start, duration } = BREAK_WINDOWS[rhythm]
  const phase = ((Math.max(0, finite(time, 0)) % period) + period) % period
  if (phase < start || phase > start + duration) {
    return { mix: 0, rotation: 0, jointRotation: 0 }
  }
  const u = clamp((phase - start) / duration, 0, 1)
  const mix = smoothstep(u / 0.18) * smoothstep((1 - u) / 0.22)
  const side = [-1, 1, 1, -1][index] ?? (index % 2 ? 1 : -1)
  const diagonal = [1, -1, 1, -1][index] ?? (index % 2 ? -1 : 1)

  if (rhythm === 'breathe') {
    // Signature stretch: the silhouette opens, reaches, then settles back.
    const reach = Math.sin(Math.PI * u)
    const settle = Math.sin(Math.PI * 2 * u)
    return {
      mix,
      rotation: side * (6.6 * reach + 1.3 * settle) * mix,
      jointRotation: -side * (9.4 * reach - 1.1 * settle) * mix
    }
  }

  if (rhythm === 'skitter') {
    // Signature scuttle: three fast diagonal footfalls, not random vibration.
    const footfall = Math.sin(Math.PI * 6 * u + (diagonal < 0 ? Math.PI : 0))
    const follow = Math.sin(Math.PI * 6 * u + 0.72 + (diagonal < 0 ? Math.PI : 0))
    return {
      mix,
      rotation: side * footfall * 8.2 * mix,
      jointRotation: -side * follow * 11.5 * mix
    }
  }

  // Signature curl: all legs fold inward, add one sleepy twitch, then unfurl.
  const fold = Math.sin(Math.PI * u) ** 2
  const twitch = Math.sin(Math.PI * 4 * u) * Math.sin(Math.PI * u)
  return {
    mix,
    rotation: (-side * 5.4 * fold + diagonal * 1.7 * twitch) * mix,
    jointRotation: (side * 14.5 * fold + diagonal * 2.4 * twitch) * mix
  }
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
  if (motion.amount === 0) return { rotation: 0, jointRotation: 0, reach: 0 }
  const t = Math.max(0, finite(time, 0)) * motion.speed
  const rhythm: Record<KumoMotionRhythm, { cadence: number; amplitude: number }> = {
    flow: { cadence: 1, amplitude: 0.88 },
    breathe: { cadence: 0.72, amplitude: 0.72 },
    skitter: { cadence: 2.15, amplitude: 1 },
    doze: { cadence: 0.52, amplitude: 0.52 }
  }
  const { cadence, amplitude } = rhythm[motion.rhythm]
  const pairPhase = [0, Math.PI, 0, Math.PI][index] ?? index * Math.PI * 0.5
  const direction = [-1, 1, -1, 1][index] ?? (index % 2 ? 1 : -1)
  const cycle = t * ((Math.PI * 2) / 3.4) * cadence
  const seed = [0.35, 2.15, 4.3, 5.85][index] ?? index * 1.7
  const pairedStep = Math.sin(cycle + pairPhase)
  const followThrough = Math.sin(cycle * 0.52 + pairPhase * 0.35 + index * 0.22)
  const detail = loopNoise(t, 5.2 + index * 0.31, seed) * 0.65
  const jointPulse = Math.sin(cycle * 1.18 + pairPhase + 0.82)
  const jointDetail = loopNoise(t, 4.35 + index * 0.27, seed + 1.65)
  const signature = kumoSignatureBreakAt(t, index, motion.rhythm)
  const baselineMix = 1 - signature.mix * 0.82
  const baselineRotation =
    (pairedStep * direction * 3.4 + followThrough * 1.15 + detail) * amplitude
  const baselineJoint =
    (jointPulse * direction * -5.4 + jointDetail * 1.45) * amplitude
  return {
    rotation: (baselineRotation * baselineMix + signature.rotation) * motion.amount,
    // A second, slightly delayed beat flexes the distal bone instead of moving
    // the whole Knuckle as one rigid checkmark.
    jointRotation: (baselineJoint * baselineMix + signature.jointRotation) * motion.amount,
    // The shoulder never translates: keeping its joint fixed prevents the root
    // from peeking out when a state animation squashes or stretches the body.
    reach: 0
  }
}

/**
 * Rebuilds a Knuckle as one continuous outline after rotating its distal bone.
 * Every frame keeps the same M/L/C command topology, so SVG can interpolate it.
 */
export function kumoLegPathAt(
  attachment: KumoLegGeometry,
  index: number,
  time: number,
  value: KumoMotion
): string {
  if (!attachment.knuckle) return attachment.d
  const pose = kumoLegMotionAt(time, index, value)
  return kumoLegPathWithJointRotation(attachment, pose.jointRotation)
}

/**
 * Rebuilds a Knuckle from an explicit elbow angle. The interactive web export
 * uses this for context-triggered gestures; keeping the operation here means
 * its one-shot breaks and the studio preview share the exact same smooth limb.
 */
export function kumoLegPathWithJointRotation(
  attachment: KumoLegGeometry,
  jointRotation: number
): string {
  if (!attachment.knuckle || jointRotation === 0) return attachment.d
  const { root, elbow, tip, thickness } = attachment.knuckle
  const angle = (jointRotation * Math.PI) / 180
  const delta = point(tip.x - elbow.x, tip.y - elbow.y)
  const rotatedTip = point(
    elbow.x + delta.x * Math.cos(angle) - delta.y * Math.sin(angle),
    elbow.y + delta.x * Math.sin(angle) + delta.y * Math.cos(angle)
  )
  return knuckleLegPath(root, elbow, rotatedTip, thickness).d
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
