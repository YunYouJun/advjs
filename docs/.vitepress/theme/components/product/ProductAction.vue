<script setup lang="ts">
import { withBase } from 'vitepress'
import { computed, ref } from 'vue'

// One way to open the product: a link, a command to copy, or a plain status when nothing is published yet.
const props = defineProps<{
  label: string
  note?: string
  href?: string
  command?: string
  primary?: boolean
  /** Feature-status id, when this way to open the product isn't finished */
  status?: string
}>()

const external = computed(() => !!props.href && /^https?:/.test(props.href))
const target = computed(() => props.href && (external.value ? props.href : withBase(props.href)))

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  }
  catch {
    return
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => copied.value = false, 1600)
}
</script>

<template>
  <div class="product-action" :class="{ primary }">
    <a
      v-if="target"
      class="link"
      :href="target"
      :target="external ? '_blank' : undefined"
      :rel="external ? 'noreferrer' : undefined"
    >
      {{ label }}
      <span :class="external ? 'i-ri-arrow-right-up-line' : 'i-ri-arrow-right-line'" aria-hidden="true" />
    </a>
    <button
      v-else-if="command"
      type="button"
      class="command"
      :aria-label="`${label}：复制 ${command}`"
      @click="copy(command)"
    >
      <code>{{ command }}</code>
      <span :class="copied ? 'i-ri-check-line' : 'i-ri-file-copy-line'" aria-hidden="true" />
    </button>
    <span v-else class="status">
      <span v-if="!status" class="dot" aria-hidden="true" />
      {{ label }}
    </span>
    <span v-if="note || command || status" class="note" aria-live="polite">
      <FeatureStatus v-if="status" :id="status" link />
      {{ command && copied ? '已复制' : (command ? label : note) }}
    </span>
  </div>
</template>

<style scoped lang="scss">
.product-action {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.link,
.command,
.status {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 40px;
  font-size: 15px;
  font-weight: 600;
}

.vp-doc .link {
  padding: 0 2px;
  color: var(--vp-c-text-1);
  text-decoration: none;
  border-bottom: 1px solid var(--vp-c-divider);
  transition:
    color 0.2s var(--p-ease),
    border-color 0.2s var(--p-ease);

  &:hover {
    color: var(--vp-c-brand-1);
    border-color: currentColor;
  }
}

.vp-doc .primary .link {
  padding: 0 18px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 6px;
  color: var(--vp-c-white);
  background: var(--vp-c-brand-1);

  &:hover {
    color: var(--vp-c-white);
    background: var(--vp-c-brand-2);
    border-color: var(--vp-c-brand-2);
  }

  .dark & {
    color: #04101f;

    &:hover {
      color: #04101f;
    }
  }
}

.command {
  padding: 0 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  cursor: pointer;
  transition: border-color 0.2s var(--p-ease);

  code {
    font-family: var(--p-mono);
    font-size: 13px;
    font-weight: 500;
    color: var(--vp-c-text-1);
  }

  &:hover {
    border-color: var(--vp-c-brand-1);
  }
}

.status {
  color: var(--vp-c-text-2);
}

.dot {
  width: 7px;
  height: 7px;
  border: 1.5px solid var(--p-lamp);
  border-radius: 50%;
}

.note {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  align-items: center;
  font-size: 12px;
  line-height: 1.5;
  color: var(--vp-c-text-3);
}

.link:focus-visible,
.command:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
</style>
