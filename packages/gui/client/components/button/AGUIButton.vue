<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  icon?: string
  size?: 'mini' | '' | 'large'
  theme?: 'default' | 'primary' | 'danger'
  variant?: 'base' | 'outline' | 'text'
  loading?: boolean
  disabled?: boolean
}>(), {
  size: '',
  theme: 'default',
  variant: 'base',
})

const classes = computed(() => {
  const cls: string[] = []
  if (props.size)
    cls.push(props.size)
  if (props.theme !== 'default')
    cls.push(`theme-${props.theme}`)
  if (props.variant !== 'base')
    cls.push(`variant-${props.variant}`)
  if (props.loading)
    cls.push('is-loading')
  if (props.disabled || props.loading)
    cls.push('is-disabled')
  return cls
})
</script>

<template>
  <button
    :class="classes"
    :disabled="disabled || loading"
    class="agui-button"
  >
    <div v-if="loading" class="i-svg-spinners:ring-resize mr-1 inline-flex text-xs" />
    <div v-else-if="icon" class="mr-1 inline-flex" :class="icon" />
    <slot />
  </button>
</template>

<style lang="scss">
.agui-button {
  --border-radius: 2px;
}

.agui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  padding: 0 6px;
  font-size: 12px;

  appearance: none;
  background: rgba(88, 88, 88, 1) no-repeat center center;
  color: #e6e6e6;
  cursor: pointer;
  border: 1px solid transparent;

  border-radius: var(--border-radius);
  box-shadow: 0 1px 1px rgba(black, 0.3);

  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &[data-location='ALONE'] {
    border-radius: var(--border-radius);
  }
  &[data-location='LEFT'] {
    border-top-left-radius: var(--border-radius) var(--border-radius);
    border-bottom-left-radius: var(--border-radius) var(--border-radius);
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  &[data-location='RIGHT'] {
    border-top-right-radius: var(--border-radius) var(--border-radius);
    border-bottom-right-radius: var(--border-radius) var(--border-radius);
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  &:hover {
    background: rgba(100, 100, 100, 1);
    color: #ffffff;
  }
  &.pressed,
  &:active {
    background-color: #4772b3;
    color: #ffffff;
  }

  &.mini {
    font-size: 9px;
  }

  // Theme: primary
  &.theme-primary {
    background-color: #4772b3;
    color: #ffffff;

    &:hover {
      background-color: #5a85c6;
    }
    &:active {
      background-color: #3a5f96;
    }
  }

  // Theme: danger
  &.theme-danger {
    background-color: #b34747;
    color: #ffffff;

    &:hover {
      background-color: #c65a5a;
    }
    &:active {
      background-color: #963a3a;
    }
  }

  // Variant: outline
  &.variant-outline {
    background: transparent;
    border: 1px solid #585858;
    box-shadow: none;

    &:hover {
      border-color: #777;
      background: rgba(100, 100, 100, 0.2);
    }

    &.theme-primary {
      border-color: #4772b3;
      color: #7ba4d9;
      background: transparent;

      &:hover {
        background: rgba(71, 114, 179, 0.15);
        border-color: #5a85c6;
      }
    }

    &.theme-danger {
      border-color: #b34747;
      color: #d97b7b;
      background: transparent;

      &:hover {
        background: rgba(179, 71, 71, 0.15);
        border-color: #c65a5a;
      }
    }
  }

  // Variant: text
  &.variant-text {
    background: transparent;
    border: none;
    box-shadow: none;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    &.theme-primary {
      color: #7ba4d9;
      &:hover {
        background: rgba(71, 114, 179, 0.15);
      }
    }

    &.theme-danger {
      color: #d97b7b;
      &:hover {
        background: rgba(179, 71, 71, 0.15);
      }
    }
  }

  // Disabled
  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  // Loading
  &.is-loading {
    cursor: wait;
    pointer-events: none;
  }
}
</style>
