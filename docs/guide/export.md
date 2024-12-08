# 导出

## 导出视频

ADV.JS 支持将交互过程自动录制为视频。

::: tip

基于 [Videos | Playwright](https://playwright.dev/docs/videos#record-video) 实现。

默认导出格式为 `WebM`。你需要使用 [FFmpeg](https://ffmpeg.org/) 将其转换为其他格式。

:::

使用 `advjs` 导出视频。

```bash
npx advjs export
# videos/test.webm
```

使用 `FFmpeg` 将 `WebM` 转换为 `MP4`。

```bash
# test.webm -> test.mp4
ffmpeg -i test.webm test.mp4
```

TODO:

- playwright recordVideo 质量较低
  - 考虑实用 RecordRTC
