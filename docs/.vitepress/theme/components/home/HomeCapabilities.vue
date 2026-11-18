<script setup lang="ts">
import type { CapabilityStatus } from './data/capabilities'
import { computed } from 'vue'
import { useHomeCopy } from '../../composables/home'
import FeatureStatus from '../FeatureStatus.vue'
import { capabilities } from './data/capabilities'
import HomeRich from './HomeRich.vue'

const t = useHomeCopy()

const STATUSES: CapabilityStatus[] = ['shown', 'engine']

const groups = computed(() => STATUSES.map(status => ({
  status,
  ...t.value.capabilities.groups[status],
  items: capabilities
    .filter(item => item.status === status)
    .map(item => ({
      ...item,
      ...t.value.capabilities.items[item.id],
      external: item.href.startsWith('http'),
    })),
})))

const total = capabilities.length
</script>

<template>
  <section id="features" class="h-section capabilities" aria-labelledby="capabilities-title">
    <header class="h-head">
      <a class="h-anchor h-hud" href="#features">{#features}</a>
      <h2 id="capabilities-title" class="h-title">
        {{ t.capabilities.title }}
      </h2>
      <p class="h-lead">
        {{ t.capabilities.lead }}
      </p>
    </header>

    <!-- The whole picture at a glance: one bar, split by status -->
    <div class="tally" aria-hidden="true">
      <span
        v-for="group in groups"
        :key="group.status"
        class="tally-part"
        :class="`is-${group.status}`"
        :style="{ flexGrow: group.items.length }"
      >
        <span class="tally-count">{{ group.items.length }}</span>
      </span>
    </div>

    <div class="ledger">
      <section
        v-for="group in groups"
        :key="group.status"
        class="column"
        :class="`is-${group.status}`"
        :aria-labelledby="`capabilities-${group.status}`"
      >
        <h3 :id="`capabilities-${group.status}`" class="column-head">
          <span class="mark" aria-hidden="true" />
          <span class="column-title">{{ group.title }}</span>
          <span class="column-count">{{ group.items.length }} / {{ total }}</span>
        </h3>
        <p class="column-note">
          {{ group.note }}
        </p>
        <ul class="items">
          <li v-for="item in group.items" :key="item.id">
            <a
              class="item"
              :href="item.href"
              :target="item.external ? '_blank' : undefined"
              :rel="item.external ? 'noreferrer' : undefined"
            >
              <span class="item-name">{{ item.name }}<FeatureStatus v-if="item.feature" :id="item.feature" class="item-status" /></span>
              <span v-if="item.note" class="item-note"><HomeRich :text="item.note" /></span>
              <span v-if="item.external" class="item-source">{{ t.capabilities.source }}</span>
              <span class="item-arrow i-ri-arrow-right-up-line" aria-hidden="true" />
            </a>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
/* Status marks: a lit dot, a ring */
.capabilities {
  --shown: var(--vp-c-brand-1);
  --engine: var(--vp-c-text-1);
}

.tally {
  display: flex;
  gap: 3px;
  height: 22px;
  margin-bottom: 40px;
}

.tally-part {
  display: flex;
  align-items: center;
  min-width: 36px;
  padding: 0 8px;
  border-radius: 3px;
  font-family: var(--h-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.tally-part.is-shown {
  color: var(--vp-c-bg);
  background: var(--shown);
}

.tally-part.is-engine {
  color: var(--vp-c-text-1);
  box-shadow: inset 0 0 0 1.5px var(--engine);
}

.ledger {
  display: grid;
  gap: 40px;
}

@media (min-width: 960px) {
  .ledger {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    gap: 48px;
  }

  /* The engine list is the longer one: let it run in two columns of its own */
  .is-engine .items {
    columns: 2;
    column-gap: 32px;
  }

  .is-engine .items li {
    break-inside: avoid;
  }
}

.item-status {
  margin-left: 8px;
}

.column-head {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 0;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--vp-c-text-1);
  font-size: 17px;
  font-weight: 700;
}

.mark {
  flex: none;
  width: 11px;
  height: 11px;
  box-sizing: border-box;
  border-radius: 50%;
}

.is-shown .mark {
  background: var(--shown);
  box-shadow: 0 0 0 3px var(--vp-c-brand-soft);
}

.is-engine .mark {
  border: 2px solid var(--engine);
}

.column-count {
  margin-left: auto;
  font-family: var(--h-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-c-text-3);
}

.column-note {
  margin: 8px 0 6px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 10px;
  padding: 11px 2px;
  border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: background-color 0.2s;
}

.item:hover {
  background: var(--vp-c-default-soft);
}

.item-name {
  grid-column: 1;
  font-size: 15px;
  font-weight: 600;
}

.item-note {
  grid-column: 1;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-3);
}

.item-note :deep(code) {
  padding: 0 4px;
  border-radius: 3px;
  font-family: var(--h-mono);
  font-size: 0.92em;
  background: var(--vp-c-default-soft);
}

.item-source {
  grid-column: 2;
  grid-row: 1;
  align-self: center;
  font-family: var(--h-mono);
  font-size: 10.5px;
  color: var(--vp-c-text-3);
}

.item-arrow {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  justify-self: end;
  font-size: 14px;
  color: var(--vp-c-text-3);
  transition:
    color 0.2s,
    transform 0.2s var(--h-ease);
}

.item:has(.item-source) .item-arrow {
  grid-row: 2;
}

.item:hover .item-arrow,
.item:focus-visible .item-arrow {
  color: var(--vp-c-brand-1);
  transform: translate(2px, -2px);
}

@media (prefers-reduced-motion: reduce) {
  .item,
  .item-arrow {
    transition: none;
  }
}
</style>
