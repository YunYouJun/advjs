<script setup lang="ts">
import { withBase } from 'vitepress'
import { computed } from 'vue'

// A capture of the real app. `frame` draws the device around it; the image links to its full size.
const props = withDefaults(defineProps<{
  src: string
  alt: string
  width: number
  height: number
  frame?: 'browser' | 'phone' | 'none'
  url?: string
  caption?: string
  eager?: boolean
}>(), {
  frame: 'none',
})

const href = computed(() => withBase(props.src))
</script>

<template>
  <figure class="product-shot" :class="`frame-${frame}`">
    <div class="device">
      <div v-if="frame === 'browser'" class="chrome" aria-hidden="true">
        <span class="lights"><i /><i /><i /></span>
        <span v-if="url" class="url">{{ url }}</span>
      </div>
      <a class="screen" :href="href" target="_blank" rel="noreferrer" :aria-label="`${alt}（查看原图）`">
        <img
          :src="href"
          :alt="alt"
          :width="width"
          :height="height"
          :loading="eager ? 'eager' : 'lazy'"
          decoding="async"
        >
      </a>
    </div>
    <figcaption v-if="caption">
      {{ caption }}
    </figcaption>
  </figure>
</template>

<style scoped lang="scss">
.product-shot {
  margin: 0;
}

.device {
  position: relative;
  overflow: hidden;
}

.screen {
  display: block;

  img {
    display: block;
    width: 100%;
    height: auto;
  }

  &:focus-visible {
    outline: 2px solid var(--vp-c-brand-1);
    outline-offset: -2px;
  }
}

.frame-none .device {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.frame-browser .device {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  box-shadow: var(--p-shadow);
}

.chrome {
  display: flex;
  gap: 14px;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.lights {
  display: flex;
  gap: 6px;

  i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--vp-c-divider);
  }
}

.url {
  flex: 0 1 260px;
  overflow: hidden;
  padding: 2px 10px;
  border-radius: 4px;
  font-family: var(--p-mono);
  font-size: 11px;
  line-height: 1.5;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
}

// Phone: a dark bezel the same in both themes, like the hardware.
.frame-phone .device {
  padding: 7px;
  border-radius: 38px;
  background: var(--p-bezel);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    var(--p-shadow);

  .screen {
    overflow: hidden;
    border-radius: 31px;
  }
}

figcaption {
  margin-top: 10px;
  font-family: var(--p-system);
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
}
</style>
