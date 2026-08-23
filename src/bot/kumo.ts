import { clamp, loopNoise, r2 } from './math'

/** Geometry of one editable Kumo leg, in body-radius units. */
export interface KumoAttachment {
  cx: number
  cy: number
  rx: number
  ry: number
  rotation: number
}

/** User-controlled silhouette parameters. Values are deliberately normalized. */
export interface KumoDesign {
  /** -1 = taller body, 0 = round, 1 = wider body. */
  bodyAspect: number
  legLength: number
  legThickness: number
  /** -1 = legs gathered together, 1 = legs fanned apart. */
  legSpread: number
}

/** Autonomous leg movement, driven by the same looped noise used by the eyes. */
export interface KumoMotion {
  amount: number
  speed: number
}

export const DEFAULT_KUMO_DESIGN: KumoDesign = {
  bodyAspect: 0,
  legLength: 1,
  legThickness: 1,
  legSpread: 0
}

export const DEFAULT_KUMO_MOTION: KumoMotion = {
  amount: 0.55,
  speed: 1
}

const finite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function normalizeKumoDesign(value: Partial<KumoDesign> = {}): KumoDesign {
  return {
    bodyAspect: clamp(finite(value.bodyAspect, DEFAULT_KUMO_DESIGN.bodyAspect), -1, 1),
    legLength: clamp(finite(value.legLength, DEFAULT_KUMO_DESIGN.legLength), 0.75, 1.15),
    legThickness: clamp(
      finite(value.legThickness, DEFAULT_KUMO_DESIGN.legThickness),
      0.72,
      1.2
    ),
    legSpread: clamp(finite(value.legSpread, DEFAULT_KUMO_DESIGN.legSpread), -1, 1)
  }
}

export function normalizeKumoMotion(value: Partial<KumoMotion> = {}): KumoMotion {
  return {
    amount: clamp(finite(value.amount, DEFAULT_KUMO_MOTION.amount), 0, 1),
    speed: clamp(finite(value.speed, DEFAULT_KUMO_MOTION.speed), 0.35, 2)
  }
}

/** Safely restores a persisted object; malformed storage always falls back. */
export function parseKumoDesign(raw: string | null): KumoDesign {
  if (!raw) return { ...DEFAULT_KUMO_DESIGN }
  try {
    return normalizeKumoDesign(JSON.parse(raw) as Partial<KumoDesign>)
  } catch {
    return { ...DEFAULT_KUMO_DESIGN }
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

/**
 * Turns the round base profile into an ellipse without changing the radial
 * sampling contract used by the morph engine.
 */
export function designKumoBody(base: number[], value: KumoDesign): number[] {
  const design = normalizeKumoDesign(value)
  const sx = 1 + design.bodyAspect * 0.11
  const sy = 1 - design.bodyAspect * 0.09
  return base.map((radius, i) => {
    const angle = (i / base.length) * Math.PI * 2
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    return radius / Math.sqrt((c * c) / (sx * sx) + (s * s) / (sy * sy))
  })
}

/**
 * Applies the design controls to the four independent legs. The alternating
 * spread directions preserve the intentionally irregular two-by-two layout.
 */
export function designKumoAttachments(
  base: readonly KumoAttachment[],
  value: KumoDesign
): KumoAttachment[] {
  const design = normalizeKumoDesign(value)
  const sx = 1 + design.bodyAspect * 0.11
  const sy = 1 - design.bodyAspect * 0.09
  const spreadDirections = [-1, 1, 1, -1]

  return base.map((attachment, index) => {
    const x = attachment.cx * sx
    const y = attachment.cy * sy
    const delta = (spreadDirections[index] ?? 0) * design.legSpread * 15
    const angle = (delta * Math.PI) / 180
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const longX = attachment.rx >= attachment.ry

    return {
      cx: x * c - y * s,
      cy: x * s + y * c,
      rx: attachment.rx * (longX ? design.legLength : design.legThickness),
      ry: attachment.ry * (longX ? design.legThickness : design.legLength),
      rotation: attachment.rotation + delta
    }
  })
}

export interface KumoLegMotionPose {
  rotation: number
  reach: number
}

/**
 * Deterministic organic motion for one leg. Like eye liveliness, this is a pure
 * function of time made from several incommensurate loop-noise periods, so it
 * can be replayed exactly by previews and exports.
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
  return {
    rotation: (broad * 13 + detail * 3.5) * motion.amount,
    reach: loopNoise(t, 4.2 + index * 0.19, seed + 3.2) * 0.035 * motion.amount
  }
}

/** SVG transform applied around the leg's inner joint. */
export function kumoLegTransform(
  attachment: KumoAttachment,
  index: number,
  time: number,
  value: KumoMotion,
  scale: number
): string {
  const pose = kumoLegMotionAt(time, index, value)
  const distance = Math.max(0.001, Math.hypot(attachment.cx, attachment.cy))
  const ux = attachment.cx / distance
  const uy = attachment.cy / distance
  const pivotX = attachment.cx * 0.68 * scale
  const pivotY = attachment.cy * 0.68 * scale
  return `translate(${r2(ux * pose.reach * scale)} ${r2(uy * pose.reach * scale)}) rotate(${r2(pose.rotation)} ${r2(pivotX)} ${r2(pivotY)})`
}
