# InputNumber

## Input Number

<InputNumberDemo />

<<< @/.vitepress/theme/components/demo/InputNumberDemo.vue

## NumberField (Drag)

<NumberFieldDemo />

<<< @/.vitepress/theme/components/demo/NumberFieldDemo.vue

## 交互约定

`AGUIInputNumber` 用于原生数值输入；`AGUINumberField` 用于可拖动的属性字段。两者接受 `min`、`max`、`step`、`disabled`，并将 `id` / ARIA 属性传给真实输入。可见标签通过 `for` 关联 `id`，或给 NumberField 传入 `label`。

- NumberField 保留完整有效数字，`suffix` 只用于非编辑状态的显示。
- 输入期间 `change` 提供合法且已限制范围的预览值；失焦或 Enter 提交 `update:modelValue`。Escape 取消当前草稿并恢复模型值；空白和非有限数字不提交为零。
- 上下方向键与两侧按钮按 `step` 调整，始终遵守上下限。直接输入不会强制吸附步长。
- 在字段中央水平拖动可连续调整；Shift 使用 1/20 步长，Ctrl 吸附到 10 倍步长（同时按 Shift 时吸附到原步长）。拖动采用指针捕获，取消或卸载后清理，不申请指针锁定。
- `disabled` 同时禁用输入、步进和拖动。

`AGUIInputVector` 为各轴生成唯一标签 ID，使用新的向量对象触发更新，不修改传入对象。接受 `label` 和 `disabled`；窄空间按轴换行，轴颜色仅作辅助提示。
