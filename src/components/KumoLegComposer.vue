<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  DEFAULT_KUMO_LEGS,
  designKumoAttachments,
  kumoBodyAxes,
  normalizeKumoDesign,
  type KumoDesign
} from '@/bot/kumo'
import { t } from '@/i18n'

const design = defineModel<KumoDesign>({ required: true })
const selected = defineModel<number>('selected', { default: 0 })

const WIDTH = 256
const HEIGHT = 176
const CX = WIDTH / 2
const CY = HEIGHT / 2
const SCALE = 54

const axes = computed(() => kumoBodyAxes(design.value))
const renderedLegs = computed(() => designKumoAttachments(DEFAULT_KUMO_LEGS, design.value))
const dragging = ref<number | null>(null)

function anchor(index: number) {
  const leg = design.value.legs[index] ?? DEFAULT_KUMO_LEGS[index]!
  const angle = (leg.angle * Math.PI) / 180
  const x = Math.cos(angle)
  const y = Math.sin(angle)
  const edge =
    1 / Math.sqrt((x * x) / (axes.value.sx * axes.value.sx) + (y * y) / (axes.value.sy * axes.value.sy))
  return { x: CX + x * edge * SCALE * 1.03, y: CY + y * edge * SCALE * 1.03 }
}

function setLeg(index: number, patch: Partial<KumoDesign['legs'][number]>) {
  const legs = design.value.legs.map((leg) => ({ ...leg }))
  legs[index] = { ...(legs[index] ?? DEFAULT_KUMO_LEGS[index]!), ...patch }
  design.value = normalizeKumoDesign({ ...design.value, legs })
}

function angleFromPointer(event: PointerEvent) {
  const target = event.currentTarget
  const svg =
    target instanceof SVGSVGElement
      ? target
      : target instanceof SVGElement
        ? target.ownerSVGElement
        : null
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * WIDTH - CX
  const y = ((event.clientY - rect.top) / rect.height) * HEIGHT - CY
  return (Math.atan2(y, x) * 180) / Math.PI
}

function startDrag(index: number, event: PointerEvent) {
  selected.value = index
  dragging.value = index
  ;(event.currentTarget as SVGElement).setPointerCapture(event.pointerId)
  const angle = angleFromPointer(event)
  if (angle !== null) setLeg(index, { angle })
}

function drag(index: number, event: PointerEvent) {
  if (dragging.value !== index) return
  const angle = angleFromPointer(event)
  if (angle !== null) setLeg(index, { angle })
}

function dragCanvas(event: PointerEvent) {
  if (dragging.value === null) return
  const angle = angleFromPointer(event)
  if (angle !== null) setLeg(dragging.value, { angle })
}

function stopDrag() {
  dragging.value = null
}

function nudge(index: number, event: KeyboardEvent) {
  const leg = design.value.legs[index] ?? DEFAULT_KUMO_LEGS[index]!
  const angleStep = event.shiftKey ? 10 : 3
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    setLeg(index, { angle: leg.angle + (event.key === 'ArrowLeft' ? -angleStep : angleStep) })
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    setLeg(index, { reach: leg.reach + (event.key === 'ArrowUp' ? 0.04 : -0.04) })
  }
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
    <svg
      class="block h-auto w-full select-none"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      role="group"
      :aria-label="t('kumo.composerAria')"
      @pointermove="dragCanvas"
      @pointerup="stopDrag"
      @pointercancel="stopDrag"
    >
      <defs>
        <pattern id="kumo-composer-grid" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.7" fill="var(--line)" />
        </pattern>
      </defs>
      <rect :width="WIDTH" :height="HEIGHT" fill="url(#kumo-composer-grid)" />
      <ellipse
        :cx="CX"
        :cy="CY"
        :rx="axes.sx * SCALE * 1.03"
        :ry="axes.sy * SCALE * 1.03"
        fill="none"
        stroke="var(--muted)"
        stroke-width="1"
        stroke-dasharray="2 5"
        opacity="0.42"
      />

      <path
        v-for="(leg, index) in renderedLegs"
        :key="`composer-leg-${index}`"
        :d="leg.d"
        :transform="`translate(${CX} ${CY}) scale(${SCALE})`"
        fill="var(--ink)"
        :opacity="selected === index ? 0.96 : 0.32"
        stroke="var(--ink)"
        stroke-width="1.5"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
        class="transition-opacity duration-200"
      />

      <ellipse
        :cx="CX"
        :cy="CY"
        :rx="axes.sx * SCALE"
        :ry="axes.sy * SCALE"
        fill="var(--paper)"
        stroke="var(--ink)"
        stroke-width="1.5"
      />
      <ellipse
        :cx="CX - 9"
        :cy="CY - 3"
        rx="2.8"
        ry="5.5"
        fill="var(--ink)"
        transform="rotate(-8 119 85)"
      />
      <ellipse
        :cx="CX + 9"
        :cy="CY - 5"
        rx="2.8"
        ry="5.5"
        fill="var(--ink)"
        transform="rotate(8 137 83)"
      />

      <g v-for="(_, index) in design.legs" :key="`composer-handle-${index}`">
        <circle
          :cx="anchor(index).x"
          :cy="anchor(index).y"
          :r="selected === index ? 10 : 8.5"
          :fill="selected === index ? 'var(--ink)' : 'white'"
          stroke="var(--ink)"
          stroke-width="1.5"
          class="touch-none cursor-grab transition-[r,fill] duration-200 outline-none active:cursor-grabbing focus-visible:stroke-[3]"
          role="slider"
          tabindex="0"
          :aria-label="t('kumo.legHandle', { number: index + 1 })"
          :aria-valuenow="Math.round(design.legs[index]?.angle ?? 0)"
          aria-valuemin="-180"
          aria-valuemax="180"
          @pointerdown="startDrag(index, $event)"
          @pointermove="drag(index, $event)"
          @pointerup="stopDrag"
          @pointercancel="stopDrag"
          @lostpointercapture="stopDrag"
          @keydown="nudge(index, $event)"
          @focus="selected = index"
        />
        <text
          :x="anchor(index).x"
          :y="anchor(index).y + 0.5"
          text-anchor="middle"
          dominant-baseline="middle"
          :fill="selected === index ? 'white' : 'var(--ink)'"
          class="pointer-events-none text-[9px] font-semibold"
        >
          {{ index + 1 }}
        </text>
      </g>
    </svg>
    <p class="border-t border-[var(--line)] px-3 py-2 text-[11px] leading-snug text-[var(--muted)]">
      {{ t('kumo.dragHelp') }}
    </p>
  </div>
</template>
