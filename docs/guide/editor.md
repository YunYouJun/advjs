# 编辑器

渐进式编辑器

> 每个编辑器都是一个子模块，用户只需使用对应功能的编辑器。

## VRM 人物模型编辑器

我们提供了一个简要的 VRM 模型编辑器，以便你可以在线快速编辑人物动画。

并通过辅助工具，下载当前的信息。

Todo:

- 弧度角度切换（切换圆形 UI）
- 一键存储当前骨骼和表情信息
  - 两种方式切换（只保留非零数值和保留所有数值）

> [Unity 中的旋转和方向 | 欧拉角和四元数](https://docs.unity3d.com/cn/2019.4/Manual/QuaternionAndEulerRotationsInUnity.html)

与其他动画 fbx 格式的不同

### 与 VRoid 的区别？

VRoid 是官方的 VRM 模型制作客户端，但其并未提供动作数据导出功能。

该编辑器可在网页端运行，并希望可以通过 JSON 数据来导出记录动作。

<!-- https://pixiv.github.io/three-vrm/docs/interfaces/vrmpose.html -->

## Useful Links

- [Mixamo](https://www.mixamo.com/): Adobe 出品，可下载动作数据
