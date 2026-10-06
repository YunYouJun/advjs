# NumberSlider

<NumberSliderDemo />

<<< @/.vitepress/theme/components/demo/NumberSliderDemo.vue

## 与 NumberField 共用输入契约

`AGUINumberSlider` 是带范围进度显示的数值字段，与 [NumberField](./input-number) 共用精度、提交、取消、步进、拖动和禁用逻辑。接受 `label`、`title`、`suffix`、`id`、`min`、`max`、`step`、`disabled`；`title` 可显示在字段左侧，`label` 用于可访问名称。

只有 `max > min` 时显示范围进度。进度使用 AGUI 选择背景 token，不承载成功或警告含义；输入时收起进度和标题以便精确编辑。
