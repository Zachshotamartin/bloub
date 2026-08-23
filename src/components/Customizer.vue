<script setup lang="ts">
import { computed, ref } from 'vue'
import BotTile from '@/components/BotTile.vue'
import KumoLegComposer from '@/components/KumoLegComposer.vue'
import { EXPRESSIONS } from '@/bot/expressions'
import { COLORS, SHAPES } from '@/bot/skins'
import {
  DEFAULT_KUMO_DESIGN,
  DEFAULT_KUMO_MOTION,
  KUMO_EYE_COLORS,
  KUMO_LEG_STYLE_IDS,
  KUMO_MOTION_RHYTHM_IDS,
  KUMO_STANCES,
  normalizeKumoDesign,
  normalizeKumoMotion,
  type KumoDesign,
  type KumoLegStyle,
  type KumoMotion
} from '@/bot/kumo'
import { nombre, pourcentage, t } from '@/i18n'

const shape = defineModel<string>('shape', { required: true })
const color = defineModel<string>('color', { required: true })
const expression = defineModel<string>('expression', { required: true })
const kumoDesign = defineModel<KumoDesign>('kumoDesign', { required: true })
const legMotion = defineModel<KumoMotion>('legMotion', { required: true })

function inputValue(event: Event) {
  return Number((event.target as HTMLInputElement).value)
}

function setDesign<Key extends keyof KumoDesign>(key: Key, value: KumoDesign[Key]) {
  kumoDesign.value = normalizeKumoDesign({ ...kumoDesign.value, [key]: value })
}

function setMotion<Key extends keyof KumoMotion>(key: Key, value: KumoMotion[Key]) {
  legMotion.value = normalizeKumoMotion({ ...legMotion.value, [key]: value })
}

function resetKumo() {
  kumoDesign.value = normalizeKumoDesign(DEFAULT_KUMO_DESIGN)
  legMotion.value = { ...DEFAULT_KUMO_MOTION }
}

const selectedLeg = ref(0)
const selectedLegValue = computed(() => kumoDesign.value.legs[selectedLeg.value]!)

function setSelectedLeg<Key extends keyof KumoDesign['legs'][number]>(
  key: Key,
  value: KumoDesign['legs'][number][Key]
) {
  const legs = kumoDesign.value.legs.map((leg) => ({ ...leg }))
  legs[selectedLeg.value] = { ...legs[selectedLeg.value]!, [key]: value }
  kumoDesign.value = normalizeKumoDesign({ ...kumoDesign.value, legs })
}

function setLegStyle(style: KumoLegStyle) {
  kumoDesign.value = normalizeKumoDesign({ ...kumoDesign.value, legStyle: style })
}

function applyStance(index: number) {
  const stance = KUMO_STANCES[index]
  if (!stance) return
  kumoDesign.value = normalizeKumoDesign({
    ...kumoDesign.value,
    legs: stance.legs.map((leg) => ({ ...leg }))
  })
}

/** Produces a bounded, fully editable gesture rather than a hidden random seed. */
function newVariation() {
  const between = (min: number, max: number) => min + Math.random() * (max - min)
  const stance = KUMO_STANCES[Math.floor(Math.random() * KUMO_STANCES.length)]!
  const style = KUMO_LEG_STYLE_IDS[Math.floor(Math.random() * KUMO_LEG_STYLE_IDS.length)]!
  const eyeColor = KUMO_EYE_COLORS[Math.floor(Math.random() * KUMO_EYE_COLORS.length)]!.hex
  kumoDesign.value = normalizeKumoDesign({
    bodyAspect: between(-0.85, 0.85),
    legLength: between(0.82, 1.22),
    legThickness: between(0.75, 1.24),
    legStyle: style,
    eyeColor,
    legs: stance.legs.map((leg) => ({
      angle: leg.angle + between(-12, 12),
      reach: leg.reach * between(0.88, 1.12),
      bend: leg.bend + between(-0.18, 0.18)
    }))
  })
}

const bodyAspectText = computed(() => {
  if (Math.abs(kumoDesign.value.bodyAspect) < 0.08) return t('kumo.round')
  return kumoDesign.value.bodyAspect < 0 ? t('kumo.tall') : t('kumo.wide')
})

/**
 * Les vignettes sont figees a la meme date que la pose de repos : elles montrent
 * la forme et le visage tels qu'ils apparaitront, pas un aplat abstrait.
 */
const PREVIEW_AT = 1
</script>

<template>
  <div>
    <h2 class="text-sm font-semibold">{{ t('panel.shape') }}</h2>
    <div class="mt-2 grid grid-cols-4 gap-1.5">
      <BotTile
        v-for="s in SHAPES"
        :key="s.id"
        :label="t(`shapes.${s.id}`)"
        :selected="s.id === shape"
        :shape="s.id"
        :color="color"
        :expression="expression"
        :kumo-design="kumoDesign"
        :leg-motion="legMotion"
        :frozen-at="PREVIEW_AT"
        @click="shape = s.id"
      />
    </div>

    <section v-if="shape === 'kumo'" class="mt-4 rounded-2xl border border-[var(--line)] p-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-xs font-semibold">{{ t('kumo.design') }}</h3>
          <p class="mt-0.5 text-xs leading-snug text-[var(--muted)]">{{ t('kumo.designHelp') }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 cursor-pointer rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-xs font-medium text-[var(--paper)] transition hover:-translate-y-px hover:opacity-90 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
          @click="newVariation"
        >
          {{ t('kumo.variation') }}
        </button>
      </div>

      <label class="mt-4 block text-xs">
        <span class="flex items-center justify-between gap-2">
          <span>{{ t('kumo.bodyAspect') }}</span>
          <span class="text-[var(--muted)]">{{ bodyAspectText }}</span>
        </span>
        <input
          type="range"
          class="mt-1 h-1 w-full cursor-pointer accent-[var(--ink)]"
          min="-1"
          max="1"
          step="0.02"
          :value="kumoDesign.bodyAspect"
          :aria-valuetext="bodyAspectText"
          @input="setDesign('bodyAspect', inputValue($event))"
        />
      </label>

      <div class="mt-4">
        <h4 class="text-[11px] font-semibold tracking-wide text-[var(--muted)]">
          {{ t('kumo.eyeColor') }}
        </h4>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="eye in KUMO_EYE_COLORS"
            :key="eye.id"
            type="button"
            class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border transition hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
            :class="
              kumoDesign.eyeColor === eye.hex
                ? 'border-[var(--ink)]'
                : 'border-transparent hover:border-[var(--line)]'
            "
            :aria-label="t(`kumo.eye_${eye.id}`)"
            :aria-pressed="kumoDesign.eyeColor === eye.hex"
            @click="setDesign('eyeColor', eye.hex)"
          >
            <span
              class="h-5 w-5 rounded-full ring-1 ring-black/10 ring-inset"
              :style="{ backgroundColor: eye.hex }"
            />
          </button>
        </div>
      </div>

      <div class="mt-4">
        <h4 class="text-[11px] font-semibold tracking-wide text-[var(--muted)]">
          {{ t('kumo.legLanguage') }}
        </h4>
        <div class="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-black/[0.035] p-1">
          <button
            v-for="style in KUMO_LEG_STYLE_IDS"
            :key="style"
            type="button"
            class="cursor-pointer rounded-lg px-2 py-1.5 text-xs transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ink)]"
            :class="
              kumoDesign.legStyle === style
                ? 'bg-white font-medium text-[var(--ink)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            "
            :aria-pressed="kumoDesign.legStyle === style"
            @click="setLegStyle(style)"
          >
            {{ t(`kumo.style_${style}`) }}
          </button>
        </div>
        <p class="mt-1.5 text-[11px] leading-snug text-[var(--muted)]">
          {{ t(`kumo.style_${kumoDesign.legStyle}Help`) }}
        </p>
      </div>

      <div class="mt-4">
        <div class="flex items-center justify-between gap-3">
          <h4 class="text-[11px] font-semibold tracking-wide text-[var(--muted)]">
            {{ t('kumo.stance') }}
          </h4>
          <span class="text-[10px] text-[var(--muted)]">{{ t('kumo.stanceHelp') }}</span>
        </div>
        <div class="mt-1.5 grid grid-cols-4 gap-1">
          <button
            v-for="(stance, index) in KUMO_STANCES"
            :key="stance.id"
            type="button"
            class="cursor-pointer rounded-lg border border-[var(--line)] px-1 py-1.5 text-[11px] transition hover:-translate-y-px hover:border-[var(--muted)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ink)]"
            @click="applyStance(index)"
          >
            {{ t(`kumo.stance_${stance.id}`) }}
          </button>
        </div>
      </div>

      <div class="mt-3">
        <KumoLegComposer v-model="kumoDesign" v-model:selected="selectedLeg" />
      </div>

      <div class="mt-4 rounded-xl bg-black/[0.035] p-3">
        <div class="flex items-center justify-between gap-3">
          <h4 class="text-xs font-semibold">
            {{ t('kumo.selectedLeg', { number: selectedLeg + 1 }) }}
          </h4>
          <div class="flex gap-1" :aria-label="t('kumo.selectLeg')">
            <button
              v-for="(_, index) in kumoDesign.legs"
              :key="`select-leg-${index}`"
              type="button"
              class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[10px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ink)]"
              :class="
                selectedLeg === index
                  ? 'bg-[var(--ink)] text-[var(--paper)]'
                  : 'bg-white text-[var(--muted)] hover:text-[var(--ink)]'
              "
              :aria-pressed="selectedLeg === index"
              @click="selectedLeg = index"
            >
              {{ index + 1 }}
            </button>
          </div>
        </div>

        <div class="mt-3 space-y-3">
          <label class="block text-xs">
            <span class="flex items-center justify-between gap-2">
              <span>{{ t('kumo.legPosition') }}</span>
              <span class="tabular-nums text-[var(--muted)]">{{ nombre(selectedLegValue.angle) }}°</span>
            </span>
            <input
              type="range"
              class="mt-1 h-1 w-full cursor-pointer accent-[var(--ink)]"
              min="-180"
              max="180"
              step="1"
              :value="selectedLegValue.angle"
              :aria-valuetext="`${nombre(selectedLegValue.angle)}°`"
              @input="setSelectedLeg('angle', inputValue($event))"
            />
          </label>

          <label class="block text-xs">
            <span class="flex items-center justify-between gap-2">
              <span>{{ t('kumo.legReach') }}</span>
              <span class="tabular-nums text-[var(--muted)]">{{ pourcentage(selectedLegValue.reach) }}</span>
            </span>
            <input
              type="range"
              class="mt-1 h-1 w-full cursor-pointer accent-[var(--ink)]"
              min="0.65"
              max="1.35"
              step="0.01"
              :value="selectedLegValue.reach"
              :aria-valuetext="pourcentage(selectedLegValue.reach)"
              @input="setSelectedLeg('reach', inputValue($event))"
            />
          </label>

          <label class="block text-xs">
            <span class="flex items-center justify-between gap-2">
              <span>{{ t('kumo.legBend') }}</span>
              <span class="tabular-nums text-[var(--muted)]">{{ nombre(selectedLegValue.bend * 100) }}</span>
            </span>
            <input
              type="range"
              class="mt-1 h-1 w-full cursor-pointer accent-[var(--ink)]"
              min="-1"
              max="1"
              step="0.02"
              :value="selectedLegValue.bend"
              :aria-valuetext="nombre(selectedLegValue.bend * 100)"
              @input="setSelectedLeg('bend', inputValue($event))"
            />
          </label>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <label class="block text-xs">
          <span class="flex items-center justify-between gap-2">
            <span>{{ t('kumo.legLength') }}</span>
            <span class="tabular-nums text-[var(--muted)]">{{ pourcentage(kumoDesign.legLength) }}</span>
          </span>
          <input
            type="range"
            class="mt-1 h-1 w-full cursor-pointer accent-[var(--ink)]"
            min="0.72"
            max="1.3"
            step="0.01"
            :value="kumoDesign.legLength"
            :aria-valuetext="pourcentage(kumoDesign.legLength)"
            @input="setDesign('legLength', inputValue($event))"
          />
        </label>

        <label class="block text-xs">
          <span class="flex items-center justify-between gap-2">
            <span>{{ t('kumo.legThickness') }}</span>
            <span class="tabular-nums text-[var(--muted)]">{{ pourcentage(kumoDesign.legThickness) }}</span>
          </span>
          <input
            type="range"
            class="mt-1 h-1 w-full cursor-pointer accent-[var(--ink)]"
            min="0.65"
            max="1.35"
            step="0.01"
            :value="kumoDesign.legThickness"
            :aria-valuetext="pourcentage(kumoDesign.legThickness)"
            @input="setDesign('legThickness', inputValue($event))"
          />
        </label>
      </div>

      <div class="mt-4 border-t border-[var(--line)] pt-3">
        <h3 class="text-xs font-semibold">{{ t('kumo.motion') }}</h3>
        <p class="mt-0.5 text-xs leading-snug text-[var(--muted)]">{{ t('kumo.motionHelp') }}</p>

        <div class="mt-3">
          <div class="flex items-center justify-between gap-3">
            <h4 class="text-[11px] font-semibold tracking-wide text-[var(--muted)]">
              {{ t('kumo.animationBreaks') }}
            </h4>
            <span class="text-[10px] text-[var(--muted)]">{{ t('kumo.animationBreaksHelp') }}</span>
          </div>
          <div class="mt-1.5 grid grid-cols-4 gap-1 rounded-xl bg-black/[0.035] p-1">
            <button
              v-for="rhythm in KUMO_MOTION_RHYTHM_IDS"
              :key="rhythm"
              type="button"
              class="cursor-pointer rounded-lg px-1 py-1.5 text-[11px] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ink)]"
              :class="
                legMotion.rhythm === rhythm
                  ? 'bg-white font-medium text-[var(--ink)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              "
              :aria-pressed="legMotion.rhythm === rhythm"
              @click="setMotion('rhythm', rhythm)"
            >
              {{ t(`kumo.rhythm_${rhythm}`) }}
            </button>
          </div>
          <p class="mt-1.5 text-[11px] leading-snug text-[var(--muted)]">
            {{ t(`kumo.break_${legMotion.rhythm}Help`) }}
          </p>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-3">
          <label class="block text-xs">
            <span class="flex items-center justify-between gap-2">
              <span>{{ t('kumo.motionAmount') }}</span>
              <span class="tabular-nums text-[var(--muted)]">{{ pourcentage(legMotion.amount) }}</span>
            </span>
            <input
              type="range"
              class="mt-1 h-1 w-full cursor-pointer accent-[var(--ink)]"
              min="0"
              max="1"
              step="0.01"
              :value="legMotion.amount"
              :aria-valuetext="pourcentage(legMotion.amount)"
              @input="setMotion('amount', inputValue($event))"
            />
          </label>

          <label class="block text-xs">
            <span class="flex items-center justify-between gap-2">
              <span>{{ t('kumo.motionSpeed') }}</span>
              <span class="tabular-nums text-[var(--muted)]">{{ nombre(legMotion.speed, 2) }}×</span>
            </span>
            <input
              type="range"
              class="mt-1 h-1 w-full cursor-pointer accent-[var(--ink)]"
              min="0.35"
              max="2"
              step="0.01"
              :value="legMotion.speed"
              :aria-valuetext="`${nombre(legMotion.speed, 2)}×`"
              @input="setMotion('speed', inputValue($event))"
            />
          </label>
        </div>
      </div>

      <button
        type="button"
        class="mt-3 cursor-pointer text-xs text-[var(--muted)] underline decoration-[var(--line)] underline-offset-2 transition hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
        @click="resetKumo"
      >
        {{ t('kumo.reset') }}
      </button>
    </section>

    <h2 class="mt-5 text-sm font-semibold">{{ t('panel.expression') }}</h2>
    <div class="mt-2 grid grid-cols-4 gap-1.5">
      <BotTile
        v-for="e in EXPRESSIONS"
        :key="e.id"
        :label="t(`expressions.${e.id}`)"
        :selected="e.id === expression"
        :shape="shape"
        :color="color"
        :expression="e.id"
        :kumo-design="kumoDesign"
        :leg-motion="legMotion"
        :frozen-at="PREVIEW_AT"
        @click="expression = e.id"
      />
    </div>

    <h2 class="mt-5 text-sm font-semibold">{{ t('panel.color') }}</h2>
    <div class="mt-2 grid grid-cols-6 gap-1.5">
      <button
        v-for="c in COLORS"
        :key="c.id"
        type="button"
        class="flex aspect-square cursor-pointer items-center justify-center rounded-full border-2 transition"
        :class="
          c.id === color ? 'border-[var(--ink)]' : 'border-transparent hover:border-[var(--line)]'
        "
        :aria-label="t(`colors.${c.id}`)"
        :aria-pressed="c.id === color"
        @click="color = c.id"
      >
        <!-- liseré interne : sinon la pastille creme disparait sur fond clair -->
        <span
          class="block h-[78%] w-[78%] rounded-full ring-1 ring-black/10 ring-inset"
          :style="{ background: c.hex }"
        />
      </button>
    </div>
  </div>
</template>
