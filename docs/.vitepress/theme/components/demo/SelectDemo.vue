<script lang="ts" setup>
import { ref } from 'vue'

const curOption = ref('None')
const options = [
  'None',
  'Back',
  'Front',
  'Both',
]

const curMethod = ref('alipay')
const methods = [
  {
    label: 'Alipay',
    value: 'alipay',
    icon: 'i-ri-alipay-fill',
  },
  {
    label: 'WeChat Pay',
    value: 'wechat',
    icon: 'i-ri-wechat-fill',
  },
  {
    label: 'PayPal',
    value: 'paypal',
    icon: 'i-ri-paypal-fill',
  },
]
</script>

<template>
  <AGUIDemoBlock title="Slider Demo" class="w-full">
    <AGUIForm>
      <AGUIFormItem label="Default Select">
        <AGUISelect v-model="curOption" :options="options" />
      </AGUIFormItem>

      <AGUIFormItem :label="`Pay Methods (${curMethod})`">
        <AGUISelect v-model="curMethod" :options="methods" />
      </AGUIFormItem>
    </AGUIForm>
  </AGUIDemoBlock>
</template>
