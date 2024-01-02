# VRM 模型编辑器

::: tip

- [VRM 模型编辑器](https://vrm.advjs.org): 在线 VRM 模型编辑器（当你使用 3D 能力时，你可能会用到它）
  :::

## 什么是 VRM？

VRM Consortium 于 2019 年在 SIGGRAPH Asia 上介绍了 VRM 格式，
它是一种基于 glTF 的跨平台文件格式，可以处理类人角色/化身(3D模型数据)。
VRM 文件可以在不同的环境中访问，如游戏引擎（Unity、Babylon）、Web等。

VRM 具有以下特点：

- 基于 glTF 2.0 通用 3D 格式，专用于人体骨骼模型
- 可以从人体捕捉数据复现人体动作
- 支持运行时的 VRM 导入：所有的纹理和材质以及骨骼都被包含在一个文件中，方便使用
- 支持面部表情控制（比如笑、眨眼等预设的混合变形）
- 支持三种类型着色器：MToon、Unlit、PBR
- 标准化的眼控（Eye Gaze），可处理使用骨骼、BlendShape 或 UV 控制的视线
- 实现了一种不依赖物理引擎的弹簧物理，可用于设置模型的头发、衣服等
- 可在 VR 中使用第一人称视角
- 可包含模型标题、作者、缩略图、许可证等信息

由于 VRM 应用于人物立绘系统中，基础表现仅需模拟人物衣服与头发的下垂，
因此不依赖物理引擎的弹簧物理省去了大量的物理引擎性能成本。

VRM 被设计为可在加载后立即在程序中进行使用。
被誉为元宇宙入口雏形的 VR Chat 即支持使用标准的 VRM 模型作为虚拟化身。
VRM 官方团队提供了一个针对 Unity 使用 C\# 构建的 SDK — UniVRM。
Pixiv 公司的工程师 OBUCHI Yutaka 于 2019 年的 W3C Developer Meetup 分享了 VRM 在 three.js 上的实现 — three-vrm。
VirtualCast 同样提供了一个基于 Babylon 的 VRM 实现 — babylon-vrm-loader。

> 参见：[What is VRM? What can VRM do?](https://vrm.dev/en/vrm/vrm_about)

本项目基于 [Babylon.js](https://github.com/BabylonJS/Babylon.js) 与 [babylon-vrm-loader](https://github.com/virtual-cast/babylon-vrm-loader)。

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

> [VRoid Hub](https://hub.vroid.com/)

由于使用 3D 建模软件从零开始创建人物模型十分复杂且耗费时间，制作一个完整的 3D 模型通常需要两三周时间。
Pixiv 开发了 VRoid Studio（如图~\ref{fig:vroid-studio}），并在其中预置了可商业使用的人物模型与素材，用户可以基于此快速创建 3D 模型，并可将其导出为 VRM 格式在 VR/AR 中查看使用。
此外它还搭建了一个 VRM 模型上传分享平台 VRoid Hub，这有助于用户之间对模型进行分享与改进。

VRoid 是官方的 VRM 模型制作客户端，但其并未提供动作数据导出功能。

该编辑器可在网页端运行，并希望可以通过 JSON 数据来导出记录动作。

<!-- https://pixiv.github.io/three-vrm/docs/interfaces/vrmpose.html -->

## FAQ

- [Do VRoid Studio's sample models come with conditions of use?](https://vroid.pixiv.help/hc/en-us/articles/4402614652569-Do-VRoid-Studio-s-sample-models-come-with-conditions-of-use-)
