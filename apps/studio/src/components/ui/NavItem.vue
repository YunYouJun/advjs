<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { chevronForwardOutline } from 'ionicons/icons'

defineProps<{
  icon?: string
  iconColor?: string
  iconVariant?: 'blue' | 'teal' | 'green' | 'red' | 'orange'
  label: string
  desc?: string
  badge?: string
  danger?: boolean
  /** Show chevron arrow (default: true). Set to false for external links etc. */
  chevron?: boolean
  /** Custom trailing icon (overrides chevron) */
  trailingIcon?: string
  /** Render as <a> instead of <button> */
  href?: string
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    class="nav-item"
    v-bind="href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {}"
    @click="!href && $emit('click')"
  >
    <span
      v-if="icon"
      class="nav-item__icon"
      :class="iconVariant && `nav-item__icon--${iconVariant}`"
      :style="iconColor ? { '--icon-color': iconColor } : {}"
    >
      <IonIcon :icon="icon" />
    </span>
    <span v-if="desc" class="nav-item__text">
      <span class="nav-item__label" :class="{ 'nav-item__label--danger': danger }">{{ label }}</span>
      <span class="nav-item__desc">{{ desc }}</span>
    </span>
    <span v-else class="nav-item__label" :class="{ 'nav-item__label--danger': danger }">{{ label }}</span>
    <span v-if="badge" class="nav-item__badge">{{ badge }}</span>
    <IonIcon
      v-if="trailingIcon"
      :icon="trailingIcon"
      class="nav-item__chevron"
    />
    <IonIcon
      v-else-if="chevron !== false && !href"
      :icon="chevronForwardOutline"
      class="nav-item__chevron"
    />
  </component>
</template>

<style scoped>
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: 10px var(--adv-space-md);
  min-height: 44px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  text-decoration: none;
  transition: background var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.nav-item:hover {
  background: var(--adv-surface-elevated);
}

.nav-item:active {
  background: var(--adv-surface-elevated);
}

.nav-item + .nav-item {
  border-top: 1px solid var(--adv-border-subtle);
}

/* ── Icon ── */
.nav-item__icon {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
  color: var(--icon-color, var(--adv-text-primary));
  background: color-mix(in srgb, var(--icon-color, var(--adv-text-primary)) 10%, transparent);
}

/* Named color variants (for cases without dynamic --icon-color) */
.nav-item__icon--blue {
  --icon-color: #6366f1;
}

.nav-item__icon--teal {
  --icon-color: #14b8a6;
}

.nav-item__icon--green {
  --icon-color: #10b981;
}

.nav-item__icon--red {
  --icon-color: var(--ion-color-danger, #ef4444);
}

.nav-item__icon--orange {
  --icon-color: #f97316;
}

/* ── Text ── */
.nav-item__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.nav-item__label {
  font-size: var(--adv-font-body);
  font-weight: 600;
  color: var(--adv-text-primary);
  flex: 1;
}

.nav-item__label--danger {
  color: var(--ion-color-danger);
}

.nav-item__desc {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  line-height: 1.3;
}

/* ── Trailing ── */
.nav-item__chevron {
  font-size: 14px;
  color: var(--adv-text-tertiary);
  flex-shrink: 0;
}

.nav-item__badge {
  font-size: var(--adv-font-caption);
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--adv-radius-full);
  background: rgba(99, 102, 241, 0.08);
  color: var(--ion-color-primary);
}
</style>
