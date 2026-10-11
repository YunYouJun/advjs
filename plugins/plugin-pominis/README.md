# Pominis 插件

将 Pominis 外部故事转换为 ADV.JS 章节。音乐导入需要显式映射到项目已登记音频资源，缺失映射会报告 `ADV_AUDIO_MIGRATION_UNRESOLVED`。

```ts
pluginPominis({
  storyId: 'story-id',
  audio: {
    assets: {
      'bgm/day': { kind: 'bgm', src: '/audio/day.ogg' },
    },
    themes: {
      theme_daily_rural: 'bgm/day',
    },
  },
})
```

`assets` 使用原生目录 ID 与资源投影，`themes` 只描述供应商主题到原生 ID 的映射。插件不会从主题名推测媒体路径。外部 `silence` 转为 `bgm clear`，其他已映射音乐转为独立 Audio Flow 节点，播放器统一使用 AudioEngine。

开启单文件音频捆绑后，插件读取已登记 `asset.src` 并把媒体投影为 data URL；音乐仍通过 `assetId` 地址播放。
