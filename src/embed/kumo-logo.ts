import {
  DEFAULT_KUMO_DESIGN,
  DEFAULT_KUMO_MOTION,
  designKumoAttachments,
  designKumoBody,
  kumoLegMotionAt,
  kumoLegPathWithJointRotation,
  kumoSignatureBreakAt,
  normalizeKumoDesign,
  normalizeKumoMotion,
  type KumoDesign,
  type KumoLegGeometry,
  type KumoMotion,
  type KumoMotionRhythm
} from '@/bot/kumo'
import {
  DEFAULT_EXPRESSION,
  EXPRESSION_BY_ID,
  blendExpression,
  type BotExpression
} from '@/bot/expressions'
import { blinkScale, eyePoses, liveliness } from '@/bot/face'
import { clamp, lerp, r2 } from '@/bot/math'
import { RAYON } from '@/bot/repere'
import { SHAPE_BY_ID } from '@/bot/skins'
import { capsulePath, closedPath, radiusAtAngle, toPoints, type Silhouette } from '@/bot/shape'

const SVG_NS = 'http://www.w3.org/2000/svg'
const DEFAULT_COLOR = '#d9d9d9'
const CONTEXTS = ['idle', 'loading', 'success', 'error', 'attention', 'hover'] as const
const BREAKS = ['stretch', 'scuttle', 'curl'] as const

export type KumoContext = (typeof CONTEXTS)[number]
export type KumoBreak = (typeof BREAKS)[number]

export interface KumoRuntimeConfig {
  color: string
  expression: string
  design: Partial<KumoDesign>
  motion: Partial<KumoMotion>
  followPointer: boolean
}

export interface KumoRuntimeSnapshot extends KumoRuntimeConfig {
  design: KumoDesign
  motion: KumoMotion
  context: KumoContext
}

const EXPRESSION_ALIASES: Record<string, string> = {
  neutral: 'neutre',
  attentive: 'attentif',
  surprised: 'surpris',
  excited: 'excite',
  happy: 'heureux',
  laughing: 'hilare',
  angry: 'colere',
  sad: 'triste',
  frightened: 'effraye',
  wary: 'mefiant',
  confused: 'confus',
  curious: 'curieux',
  proud: 'fier',
  shy: 'timide',
  bored: 'blase',
  sleepy: 'somnolent'
}

const BREAK_SPEC: Record<
  KumoBreak,
  { rhythm: Exclude<KumoMotionRhythm, 'flow'>; start: number; duration: number }
> = {
  stretch: { rhythm: 'breathe', start: 3.15, duration: 1.55 },
  scuttle: { rhythm: 'skitter', start: 1.95, duration: 1.15 },
  curl: { rhythm: 'doze', start: 3.85, duration: 2.15 }
}

const svgNode = <K extends keyof SVGElementTagNameMap>(name: K) =>
  document.createElementNS(SVG_NS, name)

const finite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const validHex = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback

const ease = (value: number) => {
  const t = clamp(value)
  return 1 - (1 - t) ** 4
}

function expressionFor(value: string | null | undefined) {
  const id = (value ?? DEFAULT_EXPRESSION).toLowerCase()
  return EXPRESSION_BY_ID.get(EXPRESSION_ALIASES[id] ?? id) ?? EXPRESSION_BY_ID.get(DEFAULT_EXPRESSION)!
}

/**
 * Framework-free, live Kumo for use on another website. Static file exports
 * can only replay a recording; this element keeps the character engine alive
 * and exposes methods that application state can call at arbitrary times.
 */
export class KumoLogoElement extends HTMLElement {
  static observedAttributes = ['color', 'config', 'context', 'expression', 'follow-pointer']

  private readonly shadow: ShadowRoot
  private readonly svg = svgNode('svg')
  private readonly scene = svgNode('g')
  private readonly legsGroup = svgNode('g')
  private readonly body = svgNode('path')
  private readonly eyesGroup = svgNode('g')
  private readonly eyeNodes = [svgNode('path'), svgNode('path')]
  private readonly legNodes: Array<{ group: SVGGElement; path: SVGPathElement }> = []

  private design = normalizeKumoDesign(DEFAULT_KUMO_DESIGN)
  private motion = normalizeKumoMotion(DEFAULT_KUMO_MOTION)
  private attachments: KumoLegGeometry[] = []
  private bodyRadii: number[] = []
  private color = DEFAULT_COLOR
  private baseExpression = expressionFor(DEFAULT_EXPRESSION)
  private expressionFrom: BotExpression = this.baseExpression
  private expressionTo: BotExpression = this.baseExpression
  private expressionChangedAt = 0
  private readonly expressionDuration = 360
  private context: KumoContext = 'idle'
  private configuredFollowPointer = false
  private pointerFollowing = false
  private pointerTarget: { x: number; y: number } | null = null
  private manualTarget: { x: number; y: number } | null = null
  private currentLook = { x: 0, y: 0, mix: 0 }
  private activeBreak: { name: KumoBreak; startedAt: number } | null = null
  private startedAt = 0
  private previousAt = 0
  private raf = 0
  private reduceMotion = false
  private connected = false

  private readonly reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = `
      :host { display: inline-block; width: 280px; max-width: 100%; aspect-ratio: 1; contain: layout style; }
      svg { display: block; width: 100%; height: 100%; overflow: visible; }
    `
    this.svg.setAttribute('width', '100%')
    this.svg.setAttribute('height', '100%')
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    this.svg.setAttribute('role', 'img')
    this.svg.setAttribute('aria-label', this.getAttribute('aria-label') ?? 'Animated Kumo logo')

    this.body.setAttribute('data-kumo-body', '')
    this.eyeNodes.forEach((eye, index) => {
      eye.setAttribute('data-kumo-eye', String(index))
      this.eyesGroup.append(eye)
    })
    this.scene.append(this.legsGroup, this.body, this.eyesGroup)
    this.svg.append(this.scene)
    this.shadow.append(style, this.svg)
    this.updateGeometry()
  }

  connectedCallback() {
    if (this.connected) return
    this.connected = true
    this.reduceMotion = this.reducedMotionQuery.matches
    this.reducedMotionQuery.addEventListener('change', this.onReducedMotion)
    this.startedAt = performance.now()
    this.previousAt = this.startedAt
    this.syncPointerListener()
    this.raf = requestAnimationFrame(this.tick)
    this.dispatchEvent(new CustomEvent('kumo-ready', { bubbles: true }))
  }

  disconnectedCallback() {
    this.connected = false
    cancelAnimationFrame(this.raf)
    this.reducedMotionQuery.removeEventListener('change', this.onReducedMotion)
    this.detachPointerListener()
  }

  attributeChangedCallback(name: string, _oldValue: string | null, value: string | null) {
    if (name === 'config' && value) {
      try {
        this.configure(JSON.parse(value) as Partial<KumoRuntimeConfig>)
      } catch {
        // Invalid host-authored JSON is ignored; the default character remains usable.
      }
      return
    }
    if (name === 'color') {
      this.configure({ color: value ?? DEFAULT_COLOR })
      return
    }
    if (name === 'expression' && value) {
      // An attribute is declarative configuration, so it becomes the idle
      // expression that resumeIdle() returns to, not a temporary reaction.
      this.configure({ expression: value })
      return
    }
    if (name === 'follow-pointer') {
      this.followPointer(value !== null && value !== 'false')
      return
    }
    if (name === 'context' && value) this.applyContext(value)
  }

  /** Apply a studio design or update any subset of it at runtime. */
  configure(value: Partial<KumoRuntimeConfig> = {}) {
    if (value.design) this.design = normalizeKumoDesign({ ...this.design, ...value.design })
    if (value.motion) this.motion = normalizeKumoMotion({ ...this.motion, ...value.motion })
    if (value.color !== undefined) this.color = validHex(value.color, this.color)
    if (value.expression !== undefined) {
      this.baseExpression = expressionFor(value.expression)
      this.transitionTo(this.baseExpression)
    }
    if (value.followPointer !== undefined) {
      this.configuredFollowPointer = Boolean(value.followPointer)
      this.pointerFollowing = this.configuredFollowPointer
      this.syncPointerListener()
    }
    this.updateGeometry()
    return this
  }

  /** The complete normalized configuration currently owned by the element. */
  getConfig(): KumoRuntimeSnapshot {
    return {
      color: this.color,
      expression: this.baseExpression.id,
      design: normalizeKumoDesign(this.design),
      motion: normalizeKumoMotion(this.motion),
      followPointer: this.configuredFollowPointer,
      context: this.context
    }
  }

  /** Property form for frameworks that prefer assigning props over methods. */
  get config() {
    return this.getConfig()
  }

  set config(value: Partial<KumoRuntimeConfig>) {
    this.configure(value)
  }

  /** Set an expression by English name or by the studio's original id. */
  setExpression(name: string) {
    const id = EXPRESSION_ALIASES[name.toLowerCase()] ?? name.toLowerCase()
    const next = EXPRESSION_BY_ID.get(id)
    if (!next) return false
    this.transitionTo(next)
    return true
  }

  /** Aim with normalized coordinates: x and y both run from -1 to 1. */
  lookAt(x: number, y: number) {
    this.manualTarget = {
      x: clamp(finite(x, 0), -1, 1),
      y: clamp(finite(y, 0), -1, 1)
    }
    return this
  }

  /** Release a programmatic target so autonomous or pointer gaze can resume. */
  clearLook() {
    this.manualTarget = null
    return this
  }

  /** Turn document-level pointer gaze on or off. */
  followPointer(on = true) {
    this.configuredFollowPointer = Boolean(on)
    this.pointerFollowing = Boolean(on)
    this.syncPointerListener()
    return this
  }

  /** Play one authored interruption immediately without stopping normal motion. */
  playBreak(name: KumoBreak | string) {
    if (!BREAKS.includes(name as KumoBreak)) return false
    this.activeBreak = { name: name as KumoBreak, startedAt: performance.now() }
    this.dispatchEvent(
      new CustomEvent('kumo-break-start', { detail: { name }, bubbles: true })
    )
    return true
  }

  /**
   * Map application situations to a face, gaze behavior, and unique gesture.
   * Calls are intentionally imperative: a loading result can arrive at any time.
   */
  setContext(name: KumoContext | string) {
    if (!CONTEXTS.includes(name as KumoContext)) return false
    if (this.getAttribute('context') !== name) this.setAttribute('context', name)
    else this.applyContext(name)
    return true
  }

  /** Return from an application reaction to the configured autonomous idle. */
  resumeIdle() {
    if (this.getAttribute('context') !== 'idle') this.setAttribute('context', 'idle')
    else this.applyContext('idle')
    return this
  }

  private transitionTo(next: BotExpression) {
    const now = performance.now()
    this.expressionFrom = this.expressionAt(now)
    this.expressionTo = next
    this.expressionChangedAt = now
  }

  private expressionAt(now: number) {
    if (!this.expressionChangedAt) return this.expressionTo
    const progress = ease((now - this.expressionChangedAt) / this.expressionDuration)
    return blendExpression(this.expressionFrom, this.expressionTo, progress)
  }

  private applyContext(value: string) {
    if (!CONTEXTS.includes(value as KumoContext)) return
    this.context = value as KumoContext
    this.manualTarget = null

    if (this.context === 'loading') {
      this.pointerFollowing = false
      this.transitionTo(expressionFor('attentive'))
      this.playBreak('scuttle')
    } else if (this.context === 'success') {
      this.pointerFollowing = false
      this.transitionTo(expressionFor('happy'))
      this.playBreak('stretch')
    } else if (this.context === 'error') {
      this.pointerFollowing = false
      this.transitionTo(expressionFor('sad'))
      this.playBreak('curl')
    } else if (this.context === 'attention') {
      this.pointerFollowing = false
      this.transitionTo(expressionFor('surprised'))
      this.playBreak('stretch')
    } else if (this.context === 'hover') {
      this.pointerFollowing = true
      this.transitionTo(expressionFor('curious'))
    } else {
      this.pointerFollowing = this.configuredFollowPointer
      this.transitionTo(this.baseExpression)
    }
    this.syncPointerListener()
    this.dispatchEvent(
      new CustomEvent('kumo-context-change', { detail: { context: this.context }, bubbles: true })
    )
  }

  private updateGeometry() {
    const skin = SHAPE_BY_ID.get('kumo')!
    this.bodyRadii = designKumoBody(skin.radii, this.design)
    this.attachments = designKumoAttachments(skin.attachments ?? [], this.design)
    const silhouette: Silhouette = {
      radii: this.bodyRadii,
      rot: 0,
      cx: 0,
      cy: 0,
      sx: 1,
      sy: 1
    }
    this.body.setAttribute('d', closedPath(toPoints(silhouette, RAYON)))
    this.body.setAttribute('fill', this.color)
    this.eyeNodes.forEach((eye) => eye.setAttribute('fill', this.design.eyeColor))

    this.legsGroup.replaceChildren()
    this.legNodes.length = 0
    this.attachments.forEach((attachment, index) => {
      const group = svgNode('g')
      const path = svgNode('path')
      group.setAttribute('data-kumo-leg', String(index))
      path.setAttribute('d', attachment.d)
      path.setAttribute('transform', `scale(${RAYON})`)
      path.setAttribute('fill', this.color)
      path.setAttribute('stroke', 'none')
      group.append(path)
      this.legsGroup.append(group)
      this.legNodes.push({ group, path })
    })

    const bodyExtent = Math.max(...this.bodyRadii)
    const legExtent = this.attachments.reduce(
      (largest, leg) =>
        Math.max(
          largest,
          Math.abs(leg.minX),
          Math.abs(leg.maxX),
          Math.abs(leg.minY),
          Math.abs(leg.maxY)
        ),
      0
    )
    // Flexing Knuckles and signature reaches need breathing room beyond authored bounds.
    const half = Math.ceil(RAYON * (Math.max(bodyExtent, legExtent) + 0.18))
    this.svg.setAttribute('viewBox', `${-half} ${-half} ${half * 2} ${half * 2}`)
  }

  private readonly tick = (now: number) => {
    if (!this.connected) return
    const elapsed = ((now - this.startedAt) / 1000) * (this.reduceMotion ? 0.45 : 1)
    const dt = Math.min(0.05, Math.max(0, (now - this.previousAt) / 1000))
    this.previousAt = now
    this.render(elapsed, now, dt)
    this.raf = requestAnimationFrame(this.tick)
  }

  private render(time: number, now: number, dt: number) {
    const life = liveliness(time, { wander: 1, blink: true, float: true })
    const expression = this.expressionAt(now)
    const contextTarget =
      this.context === 'loading'
        ? { x: Math.sin(time * 2.1) * 0.72, y: Math.sin(time * 1.1 + 0.8) * 0.22 }
        : this.context === 'success'
          ? { x: 0, y: -0.28 }
          : this.context === 'error'
            ? { x: -0.24, y: 0.48 }
            : this.context === 'attention'
              ? { x: 0, y: -0.62 }
              : null
    const desired = this.manualTarget ?? this.pointerTarget ?? contextTarget
    const smoothing = 1 - Math.exp(-dt * 9)
    this.currentLook.x = lerp(this.currentLook.x, desired?.x ?? 0, smoothing)
    this.currentLook.y = lerp(this.currentLook.y, desired?.y ?? 0, smoothing)
    this.currentLook.mix = lerp(this.currentLook.mix, desired ? 0.9 : 0, smoothing)

    const gaze = {
      yaw:
        lerp(expression.gaze.yaw, this.currentLook.x * 52, this.currentLook.mix) + life.dYaw,
      pitch:
        lerp(expression.gaze.pitch, this.currentLook.y * -38, this.currentLook.mix) + life.dPitch,
      roll: expression.gaze.roll + life.dRoll
    }
    const poses = eyePoses(gaze, RAYON, expression.split)
    for (let index = 0; index < this.eyeNodes.length; index++) {
      const eye = this.eyeNodes[index]!
      const pose = poses[index]!
      const config = expression.eyes[index]!
      if (pose.depth <= 0.02) {
        eye.setAttribute('opacity', '0')
        continue
      }
      const phi = ((config.tilt ?? 0) * Math.PI) / 180
      const cp = Math.cos(phi)
      const sp = Math.sin(phi)
      const ax = pose.a * cp + pose.c * sp
      const ay = pose.b * cp + pose.d * sp
      const cx = -pose.a * sp + pose.c * cp
      const cy = -pose.b * sp + pose.d * cp
      const lid = blinkScale(Math.min(life.lid, config.open))
      const fit = radiusAtAngle(this.bodyRadii, Math.atan2(pose.y, pose.x))
      eye.setAttribute('d', capsulePath(config.w * RAYON, config.h * RAYON))
      eye.setAttribute(
        'transform',
        `matrix(${r2(ax)},${r2(ay * lid)},${r2(cx)},${r2(cy * lid)},${r2(pose.x * fit)},${r2(pose.y * fit)})`
      )
      eye.setAttribute('opacity', String(clamp(pose.depth / 0.12)))
    }

    this.scene.setAttribute(
      'transform',
      `translate(${r2(life.driftX * RAYON)} ${r2(life.driftY * RAYON)}) scale(1 ${r2(life.breath)})`
    )

    let manualSignature: { name: KumoBreak; progress: number } | null = null
    if (this.activeBreak) {
      const spec = BREAK_SPEC[this.activeBreak.name]
      const progress = (now - this.activeBreak.startedAt) / (spec.duration * 1000)
      if (progress >= 1) {
        const finished = this.activeBreak.name
        this.activeBreak = null
        this.dispatchEvent(
          new CustomEvent('kumo-break-end', { detail: { name: finished }, bubbles: true })
        )
      } else {
        manualSignature = { name: this.activeBreak.name, progress: clamp(progress) }
      }
    }

    this.attachments.forEach((attachment, index) => {
      const base = kumoLegMotionAt(time, index, this.motion)
      let rotation = base.rotation
      let jointRotation = base.jointRotation
      if (manualSignature) {
        const spec = BREAK_SPEC[manualSignature.name]
        const signature = kumoSignatureBreakAt(
          spec.start + manualSignature.progress * spec.duration,
          index,
          spec.rhythm
        )
        rotation = base.rotation * (1 - signature.mix) + signature.rotation * this.motion.amount
        jointRotation =
          base.jointRotation * (1 - signature.mix) + signature.jointRotation * this.motion.amount
      }
      const pivotX = attachment.pivotX * RAYON
      const pivotY = attachment.pivotY * RAYON
      const node = this.legNodes[index]!
      node.group.setAttribute(
        'transform',
        `rotate(${r2(rotation)} ${r2(pivotX)} ${r2(pivotY)})`
      )
      node.path.setAttribute('d', kumoLegPathWithJointRotation(attachment, jointRotation))
    })
  }

  private readonly onPointerMove = (event: PointerEvent) => {
    if (!this.pointerFollowing || event.pointerType === 'touch') return
    const bounds = this.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    this.pointerTarget = {
      x: clamp((event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width * 0.58), -1, 1),
      y: clamp((event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height * 0.58), -1, 1)
    }
  }

  private readonly onPointerLeave = () => {
    this.pointerTarget = null
  }

  private readonly onReducedMotion = (event: MediaQueryListEvent) => {
    this.reduceMotion = event.matches
  }

  private syncPointerListener() {
    this.detachPointerListener()
    if (!this.connected || !this.pointerFollowing) return
    window.addEventListener('pointermove', this.onPointerMove)
    document.addEventListener('pointerleave', this.onPointerLeave)
  }

  private detachPointerListener() {
    window.removeEventListener('pointermove', this.onPointerMove)
    document.removeEventListener('pointerleave', this.onPointerLeave)
    this.pointerTarget = null
  }
}

if (!customElements.get('kumo-logo')) customElements.define('kumo-logo', KumoLogoElement)

declare global {
  interface HTMLElementTagNameMap {
    'kumo-logo': KumoLogoElement
  }
}
