# Slider

<SliderDemo />

<<< @/.vitepress/theme/components/demo/SliderDemo.vue

## 使用方式

`AGUISlider` 接受 `modelValue`、`min`（默认 0）、`max`（默认 360）、`step`（默认 1）、`showInput`、`disabled` 和 `label`。`:max="0"` 与负数范围均有效。传入 `id` 时关联到原生 range；使用 `label` 或 `aria-labelledby` 命名滑块及可选数值框。

滑动或数值框输入同时发出 `update:modelValue` 和 `input`，值限制在范围内。`showInput` 展示 64px 数值框，滑轨占用剩余宽度；禁用状态作用于两个输入。保留原生方向键、Home / End 及焦点语义。
