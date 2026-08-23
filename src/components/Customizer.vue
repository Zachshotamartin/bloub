<script setup lang="ts">
import { computed } from 'vue'
import BotTile from '@/components/BotTile.vue'
import { EXPRESSIONS } from '@/bot/expressions'
import { COLORS, SHAPES } from '@/bot/skins'
import {
  DEFAULT_KUMO_DESIGN,
  DEFAULT_KUMO_MOTION,
  normalizeKumoDesign,
  normalizeKumoMotion,
  type KumoDesign,
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
  kumoDesign.value = { ...DEFAULT_KUMO_DESIGN }
  legMotion.value = { ...DEFAULT_KUMO_MOTION }
}

/** Produces a bounded, editable silhouette rather than a hidden random seed. */
function newVariation() {
  const between = (min: number, max: number) => min + Math.random() * (max - min)
  kumoDesign.value = normalizeKumoDesign({
    bodyAspect: between(-0.85, 0.85),
    legLength: between(0.78, 1.15),
    legThickness: between(0.74, 1.18),
    legSpread: between(-0.9, 0.9)
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
          class="shrink-0 cursor-pointer rounded-lg border border-[var(--line)] px-2 py-1 text-xs transition hover:border-[var(--muted)]"
          @click="newVariation"
        >
          {{ t('kumo.variation') }}
        </button>
      </div>

      <div class="mt-3 space-y-3">
        <label class="block text-xs">
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

        <label class="block text-xs">
          <span class="flex items-center justify-between gap-2">
            <span>{{ t('kumo.legLength') }}</span>
            <span class="tabular-nums text-[var(--muted)]">{{ pourcentage(kumoDesign.legLength) }}</span>
          </span>
          <input
            type="range"
            class="mt-1 h-1 w-full cursor-pointer accent-[var(--ink)]"
            min="0.75"
            max="1.15"
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
            min="0.72"
            max="1.2"
            step="0.01"
            :value="kumoDesign.legThickness"
            :aria-valuetext="pourcentage(kumoDesign.legThickness)"
            @input="setDesign('legThickness', inputValue($event))"
          />
        </label>

        <label class="block text-xs">
          <span class="flex items-center justify-between gap-2">
            <span>{{ t('kumo.legSpread') }}</span>
            <span class="tabular-nums text-[var(--muted)]">{{ nombre(kumoDesign.legSpread * 15) }}°</span>
          </span>
          <input
            type="range"
            class="mt-1 h-1 w-full cursor-pointer accent-[var(--ink)]"
            min="-1"
            max="1"
            step="0.02"
            :value="kumoDesign.legSpread"
            :aria-valuetext="`${nombre(kumoDesign.legSpread * 15)}°`"
            @input="setDesign('legSpread', inputValue($event))"
          />
        </label>
      </div>

      <div class="mt-4 border-t border-[var(--line)] pt-3">
        <h3 class="text-xs font-semibold">{{ t('kumo.motion') }}</h3>
        <p class="mt-0.5 text-xs leading-snug text-[var(--muted)]">{{ t('kumo.motionHelp') }}</p>

        <div class="mt-3 space-y-3">
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
        class="mt-3 cursor-pointer text-xs text-[var(--muted)] underline decoration-[var(--line)] underline-offset-2 transition hover:text-[var(--ink)]"
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
