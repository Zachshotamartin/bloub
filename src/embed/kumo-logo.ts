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
import { BotEngine, type BotFrame } from '@/bot/engine'
import { NOTIF_BLUE } from '@/bot/decor'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { SHAPE_BY_ID, mixHex } from '@/bot/skins'
import { STATE_BY_ID, type StateId } from '@/bot/states'
import { capsulePath, closedPath, radiusAtAngle, toPoints, type Silhouette } from '@/bot/shape'
import { TOUR_TIME, tourLook } from '@/ui/gaze'

const SVG_NS = 'http://www.w3.org/2000/svg'
const DEFAULT_COLOR = '#d9d9d9'
const DEFAULT_PAPER = '#f9f9f9'
const CONTEXTS = ['idle', 'loading', 'success', 'error', 'attention', 'hover'] as const
const BREAKS = ['stretch', 'scuttle', 'curl'] as const
const ANIMATION_ALIASES: Record<string, StateId | 'intro' | 'startup'> = {
  rainbow: 'startup',
  start: 'startup'
}

export type KumoContext = (typeof CONTEXTS)[number]
export type KumoBreak = (typeof BREAKS)[number]
export type KumoAnimation = StateId | 'intro' | 'startup'

export interface KumoAnimationOptions {
  /** Seconds spent in the authored state. State-specific safe minima still apply. */
  duration?: number
  /** Morph back to the configured live idle instead of cutting at the final frame. */
  returnToIdle?: boolean
}

export type KumoAnimationStep =
  | KumoAnimation
  | { name: KumoAnimation; duration?: number; returnToIdle?: boolean }

export interface KumoRuntimeConfig {
  color: string
  paper: string
  expression: string
  design: Partial<KumoDesign>
  motion: Partial<KumoMotion>
  followPointer: boolean
}

interface ActiveAnimation {
  name: KumoAnimation
  engine: BotEngine
  startedAt: number
  stateDuration: number
  totalDuration: number
  returnAt: number | null
  returned: boolean
  eyeTour: boolean
  resolve: (completed: boolean) => void
}

let elementUid = 0

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
  private readonly defs = svgNode('defs')
  private readonly mask = svgNode('mask')
  private readonly maskBody = svgNode('path')
  private readonly maskEyes = [svgNode('path'), svgNode('path')]
  private readonly maskNotch = svgNode('circle')
  private readonly backArcs = svgNode('g')
  private readonly dotsBehind = svgNode('g')
  private readonly scene = svgNode('g')
  private readonly legsGroup = svgNode('g')
  private readonly bodyPaper = svgNode('path')
  private readonly body = svgNode('path')
  private readonly eyesGroup = svgNode('g')
  private readonly eyeNodes = [svgNode('path'), svgNode('path')]
  private readonly dotsFront = svgNode('g')
  private readonly notification = svgNode('circle')
  private readonly frontArcs = svgNode('g')
  private readonly legNodes: Array<{ group: SVGGElement; path: SVGPathElement }> = []
  private readonly uid = `kumo-runtime-${++elementUid}`
  private readonly maskId = `${this.uid}-mask`

  private design = normalizeKumoDesign(DEFAULT_KUMO_DESIGN)
  private motion = normalizeKumoMotion(DEFAULT_KUMO_MOTION)
  private attachments: KumoLegGeometry[] = []
  private bodyRadii: number[] = []
  private idleBodyPath = ''
  private color = DEFAULT_COLOR
  private paper = DEFAULT_PAPER
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
  private activeAnimation: ActiveAnimation | null = null
  private sequenceToken = 0
  private viewBoxHalf = DEMI_VIEWBOX
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

    this.mask.setAttribute('id', this.maskId)
    this.mask.setAttribute('maskUnits', 'userSpaceOnUse')
    this.maskBody.setAttribute('fill', '#fff')
    this.maskEyes.forEach((eye) => eye.setAttribute('fill', '#000'))
    this.maskNotch.setAttribute('fill', '#000')
    this.mask.append(this.maskBody, ...this.maskEyes, this.maskNotch)
    this.defs.append(this.mask)

    this.backArcs.setAttribute('fill', 'none')
    this.backArcs.setAttribute('stroke-linecap', 'round')
    this.frontArcs.setAttribute('fill', 'none')
    this.frontArcs.setAttribute('stroke-linecap', 'round')
    this.body.setAttribute('data-kumo-body', '')
    this.body.setAttribute('mask', `url(#${this.maskId})`)
    this.eyeNodes.forEach((eye, index) => {
      eye.setAttribute('data-kumo-eye', String(index))
      this.eyesGroup.append(eye)
    })
    this.notification.setAttribute('fill', NOTIF_BLUE)
    this.scene.append(this.legsGroup, this.bodyPaper, this.body, this.eyesGroup)
    this.svg.append(
      this.defs,
      this.backArcs,
      this.dotsBehind,
      this.scene,
      this.dotsFront,
      this.notification,
      this.frontArcs
    )
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
    this.cancelAnimation('disconnected')
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
    if (value.paper !== undefined) this.paper = validHex(value.paper, this.paper)
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
      paper: this.paper,
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
   * Play any authored studio state on demand. `startup` is the rainbow-ring
   * entrance with the full eye turn; `intro` is the eye turn on its own.
   * The promise resolves after Kumo has smoothly returned to live idle.
   */
  playAnimation(name: KumoAnimation | string, options: KumoAnimationOptions = {}) {
    this.sequenceToken++
    return this.startAnimation(name, options)
  }

  /** Play authored states in order, while keeping cancellation deterministic. */
  async playSequence(steps: readonly KumoAnimationStep[]) {
    const token = ++this.sequenceToken
    for (const step of steps) {
      if (token !== this.sequenceToken) return false
      const entry = typeof step === 'string' ? { name: step } : step
      const completed = await this.startAnimation(entry.name, {
        duration: entry.duration,
        returnToIdle: entry.returnToIdle
      })
      if (!completed || token !== this.sequenceToken) return false
    }
    return true
  }

  /** Cancel an authored state and immediately resume the configured live idle. */
  stopAnimation() {
    this.sequenceToken++
    this.cancelAnimation('stopped')
    return this
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

  private startAnimation(name: KumoAnimation | string, options: KumoAnimationOptions = {}) {
    const requested = name.toLowerCase()
    const normalized = (ANIMATION_ALIASES[requested] ?? requested) as KumoAnimation
    const isIntro = normalized === 'intro'
    const isStartup = normalized === 'startup'
    const state = (isIntro ? 'idle' : isStartup ? 'swirl' : normalized) as StateId
    const definition = STATE_BY_ID.get(state)
    if (!definition) return Promise.resolve(false)

    this.cancelAnimation('replaced')
    const now = performance.now()
    const requestedDuration = finite(options.duration, isIntro ? TOUR_TIME : definition.duration)
    const minimum = isIntro ? TOUR_TIME : (definition.minDuration ?? 0.2)
    const stateDuration = Math.max(minimum, requestedDuration)
    const returnToIdle = options.returnToIdle !== false && state !== 'idle'
    const returnDuration = returnToIdle ? STATE_BY_ID.get('idle')!.morph : 0
    const engine = new BotEngine(RAYON, 'idle', this.bodyRadii, this.expressionAt(now))
    if (state !== 'idle') engine.setState(state, 0)

    return new Promise<boolean>((resolve) => {
      this.activeAnimation = {
        name: normalized,
        engine,
        startedAt: now,
        stateDuration,
        totalDuration: stateDuration + returnDuration,
        returnAt: returnToIdle ? stateDuration : null,
        returned: false,
        eyeTour: isIntro || isStartup || state === 'swirl',
        resolve
      }
      this.dispatchEvent(
        new CustomEvent('kumo-animation-start', {
          detail: { name: normalized, duration: stateDuration },
          bubbles: true
        })
      )
    })
  }

  private cancelAnimation(reason: string) {
    const active = this.activeAnimation
    if (!active) return
    this.activeAnimation = null
    active.resolve(false)
    this.dispatchEvent(
      new CustomEvent('kumo-animation-cancel', {
        detail: { name: active.name, reason },
        bubbles: true
      })
    )
  }

  private finishAnimation(active: ActiveAnimation) {
    if (this.activeAnimation !== active) return
    this.activeAnimation = null
    active.resolve(true)
    this.dispatchEvent(
      new CustomEvent('kumo-animation-end', {
        detail: { name: active.name },
        bubbles: true
      })
    )
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
    const bodyPath = closedPath(toPoints(silhouette, RAYON))
    this.idleBodyPath = bodyPath
    this.bodyPaper.setAttribute('d', bodyPath)
    this.bodyPaper.setAttribute('fill', this.paper)
    this.body.setAttribute('d', bodyPath)
    this.body.setAttribute('fill', this.color)
    this.maskBody.setAttribute('d', bodyPath)
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
    this.viewBoxHalf = Math.max(DEMI_VIEWBOX, half)
    this.mask.setAttribute('x', String(-this.viewBoxHalf))
    this.mask.setAttribute('y', String(-this.viewBoxHalf))
    this.mask.setAttribute('width', String(this.viewBoxHalf * 2))
    this.mask.setAttribute('height', String(this.viewBoxHalf * 2))
    this.svg.setAttribute(
      'viewBox',
      `${-this.viewBoxHalf} ${-this.viewBoxHalf} ${this.viewBoxHalf * 2} ${this.viewBoxHalf * 2}`
    )
  }

  private readonly tick = (now: number) => {
    if (!this.connected) return
    const elapsed = ((now - this.startedAt) / 1000) * (this.reduceMotion ? 0.45 : 1)
    const dt = Math.min(0.05, Math.max(0, (now - this.previousAt) / 1000))
    this.previousAt = now
    if (this.activeAnimation) this.renderAuthoredAnimation(elapsed, now)
    else this.renderIdle(elapsed, now, dt)
    this.raf = requestAnimationFrame(this.tick)
  }

  private renderIdle(time: number, now: number, dt: number) {
    this.clearAuthoredDecor()
    this.maskBody.setAttribute('d', this.idleBodyPath)
    this.bodyPaper.setAttribute('d', this.idleBodyPath)
    this.bodyPaper.setAttribute('fill', this.paper)
    this.bodyPaper.setAttribute('opacity', '1')
    this.body.setAttribute('d', this.idleBodyPath)
    this.body.setAttribute('fill', this.color)
    this.body.setAttribute('opacity', '1')
    this.legsGroup.setAttribute('opacity', '1')
    this.legsGroup.removeAttribute('transform')
    this.maskNotch.setAttribute('r', '0')
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
        this.maskEyes[index]!.setAttribute('opacity', '0')
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
      const maskEye = this.maskEyes[index]!
      maskEye.setAttribute('d', eye.getAttribute('d') ?? '')
      maskEye.setAttribute('transform', eye.getAttribute('transform') ?? '')
      maskEye.setAttribute('opacity', eye.getAttribute('opacity') ?? '0')
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

  private renderAuthoredAnimation(globalTime: number, now: number) {
    const active = this.activeAnimation
    if (!active) return
    const local = Math.max(0, (now - active.startedAt) / 1000)
    if (active.returnAt !== null && local >= active.returnAt && !active.returned) {
      active.engine.setState('idle', active.returnAt)
      active.returned = true
    }
    if (local >= active.totalDuration) {
      this.finishAnimation(active)
      this.renderIdle(globalTime, now, 0)
      return
    }
    if (active.eyeTour) active.engine.setLook(tourLook(local), local, 1 / 60)
    this.applyAuthoredFrame(active.engine.sample(local), globalTime, active.engine.state)
  }

  private applyAuthoredFrame(frame: BotFrame, time: number, state: StateId) {
    this.scene.removeAttribute('transform')
    this.maskBody.setAttribute('d', frame.bodyPath)
    this.bodyPaper.setAttribute('d', frame.bodyPath)
    this.bodyPaper.setAttribute('fill', this.paper)
    this.bodyPaper.setAttribute('opacity', String(frame.bodyAlpha))
    this.body.setAttribute('d', frame.bodyPath)
    this.body.setAttribute('fill', this.color)
    this.body.setAttribute('opacity', String(frame.bodyAlpha))

    const bodyUsesDesign = STATE_BY_ID.get(state)?.baseBody ?? false
    const transform = frame.bodyTransform
    this.legsGroup.setAttribute('opacity', bodyUsesDesign ? String(frame.bodyAlpha) : '0')
    this.legsGroup.setAttribute(
      'transform',
      `translate(${r2(transform.x)} ${r2(transform.y)}) scale(${r2(transform.sx)} ${r2(transform.sy)}) rotate(${r2(transform.rotation)})`
    )
    if (bodyUsesDesign) {
      this.attachments.forEach((attachment, index) => {
        const motion = kumoLegMotionAt(time, index, this.motion)
        const pivotX = attachment.pivotX * RAYON
        const pivotY = attachment.pivotY * RAYON
        const node = this.legNodes[index]!
        node.group.setAttribute(
          'transform',
          `rotate(${r2(motion.rotation)} ${r2(pivotX)} ${r2(pivotY)})`
        )
        node.path.setAttribute('d', kumoLegPathWithJointRotation(attachment, motion.jointRotation))
      })
    }

    for (let index = 0; index < this.eyeNodes.length; index++) {
      const rendered = frame.eyes[index]
      const eye = this.eyeNodes[index]!
      const maskEye = this.maskEyes[index]!
      if (!rendered) {
        eye.setAttribute('opacity', '0')
        maskEye.setAttribute('opacity', '0')
        continue
      }
      maskEye.setAttribute('d', rendered.d)
      maskEye.setAttribute('transform', rendered.matrix)
      maskEye.setAttribute('opacity', String(rendered.alpha))
      eye.setAttribute('d', rendered.d)
      eye.setAttribute('transform', rendered.matrix)
      eye.setAttribute('fill', this.design.eyeColor)
      eye.setAttribute('opacity', bodyUsesDesign ? String(rendered.alpha) : '0')
    }

    if (frame.notch) {
      this.maskNotch.setAttribute('cx', String(frame.notch.x))
      this.maskNotch.setAttribute('cy', String(frame.notch.y))
      this.maskNotch.setAttribute('r', String(frame.notch.r))
    } else {
      this.maskNotch.setAttribute('r', '0')
    }

    this.renderDots(frame)
    this.renderArcs(frame)
    if (frame.notif) {
      this.notification.setAttribute('cx', String(frame.notif.x))
      this.notification.setAttribute('cy', String(frame.notif.y))
      this.notification.setAttribute('r', String(frame.notif.r))
    } else {
      this.notification.setAttribute('r', '0')
    }
  }

  private renderDots(frame: BotFrame) {
    this.dotsBehind.replaceChildren()
    this.dotsFront.replaceChildren()
    const group = frame.dotsBehind ? this.dotsBehind : this.dotsFront
    for (const dot of frame.dots) {
      const node = dot.d ? svgNode('path') : svgNode('circle')
      const fill =
        dot.color ??
        (dot.depth === undefined ? this.color : mixHex(this.paper, this.color, dot.depth))
      node.setAttribute('fill', fill)
      node.setAttribute('opacity', String(dot.opacity))
      if (dot.d) {
        node.setAttribute('d', dot.d)
        node.setAttribute(
          'transform',
          `translate(${r2(dot.x)} ${r2(dot.y)}) rotate(${r2(dot.rot ?? 0)}) scale(${RAYON})`
        )
      } else {
        node.setAttribute('cx', String(dot.x))
        node.setAttribute('cy', String(dot.y))
        node.setAttribute('r', String(dot.r))
      }
      group.append(node)
    }
  }

  private renderArcs(frame: BotFrame) {
    for (const gradient of this.defs.querySelectorAll('[data-kumo-gradient]')) gradient.remove()
    this.backArcs.replaceChildren()
    this.frontArcs.replaceChildren()
    for (const arc of frame.arcs) {
      const gradient = svgNode('linearGradient')
      const id = `${this.uid}-${arc.id}`
      gradient.setAttribute('id', id)
      gradient.setAttribute('data-kumo-gradient', '')
      gradient.setAttribute('gradientUnits', 'userSpaceOnUse')
      gradient.setAttribute('x1', String(arc.grad.x1))
      gradient.setAttribute('y1', String(arc.grad.y1))
      gradient.setAttribute('x2', String(arc.grad.x2))
      gradient.setAttribute('y2', String(arc.grad.y2))
      arc.grad.stops.forEach((color, index) => {
        const stop = svgNode('stop')
        stop.setAttribute('offset', String(index / Math.max(1, arc.grad.stops.length - 1)))
        stop.setAttribute('stop-color', color)
        gradient.append(stop)
      })
      this.defs.append(gradient)

      const makePath = (d: string) => {
        const path = svgNode('path')
        path.setAttribute('d', d)
        path.setAttribute('stroke', `url(#${id})`)
        path.setAttribute('stroke-width', String(arc.width))
        path.setAttribute('opacity', String(arc.opacity))
        return path
      }
      this.backArcs.append(makePath(arc.back))
      this.frontArcs.append(makePath(arc.front))
    }
  }

  private clearAuthoredDecor() {
    this.dotsBehind.replaceChildren()
    this.dotsFront.replaceChildren()
    this.backArcs.replaceChildren()
    this.frontArcs.replaceChildren()
    this.notification.setAttribute('r', '0')
    for (const gradient of this.defs.querySelectorAll('[data-kumo-gradient]')) gradient.remove()
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
