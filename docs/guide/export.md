# 导出

## 导出游戏产物

TODO

<!--  -->

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

- 命令行导出：playwright recordVideo 质量较低
- 浏览器录制：RecordRTC 仓库很久没有更新了，考虑使用浏览器原生支持的 MediaRecorder

- 视频处理：[ffmpegwasm](https://github.com/ffmpegwasm/ffmpeg.wasm)
