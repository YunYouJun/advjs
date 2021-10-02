---
title: 存储系统
enTitle: Storage System
---

Galgame 的存储系统主要用于存储游戏的全局配置与游戏的进度。

一般来说，游戏进度（存档）会通过新建文件譬如 `save-01.dat` 之类的方式来存储一个存档，文件的内容则是序列化后的数据，可以通过读取该数据来定位到对应的游戏进度和状态。

序列化的数据格式我们不得而知，通常因游戏而异。

## 实现方案

ADV.JS 的定位是 Web 端，我们希望玩家直接通过浏览器即可快速游玩，而没有其他安装成本。（虽然封装为 Electron 来实现客户端的跨平台也是可能的，但不在目前考虑范围。）

因此游戏本身一般没有办法直接通过浏览器 API 访问本地文件系统，除非玩家每次手动上传与导出。（当然这部分后续也是值得实现的。）

所以我们需要将数据存储至浏览器缓存本身。

[localStorage](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/localStorage) 是一个非常常用也很方便的方案，且兼容性较好。（一般浏览器容量为 5M）

当然也有容量更大的方案 [InexedDB](https://developer.mozilla.org/zh-CN/docs/Web/API/IndexedDB_API)，它的全局限制为可用磁盘空间的 50％。不过我们真的需要这么大吗？

我们的存档以及配置理论上应当是一串简单的 JSON 数据，它起的是索引的作用，而非存储整个游戏资源的作用。而 Galgame 的存档格数也往往是有限的。
如果它们的总和大小会超过 5M，我们可能需要反思一下存档设计的问题了。

但我们即便只使用 localStorage 也应当有一个封装方案，譬如自动序列化、解析数据等一些通用操作，或者我们日后想用迁移兼容在线的数据库、或是切换其他存储方案（node fs 写文件）等。

[localForage](https://github.com/localForage/localForage) 便是对 IndexedDB，WebSQL，localStorage 的一个封装方案，能够像 localStorage 一样简单的 API 来使用 IndexedDB，当浏览器不支持 IndexedDB 则回退到 WebSQL，不支持 WebSQL 再回退到 localStorage。

我也发现了一个类似的方案 [unstorage](https://github.com/unjs/unstorage)，不过看起来更为通用和现代化。

其文档中也提到了 localForage，认为与之相比，该库基于 ESM 且有更多现代化的特性以及更小的体积。

> Comparing to similar solutions like localforage, unstorage core is almost 6x smaller (28.9 kB vs 4.7 kB), using modern ESM/Typescript/Async syntax and many more features to be used universally.
