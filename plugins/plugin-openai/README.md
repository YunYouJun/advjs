# @advjs/plugin-openai

```bash
# add .env
OPENAI_API_KEY="sk-..."
```

## TTS

See [Text to speech | OpenAI API](https://platform.openai.com/docs/guides/text-to-speech?lang=javascript).

### Real Time

[Streaming realtime audio](https://platform.openai.com/docs/guides/text-to-speech#streaming-realtime-audio)

实时语音对于游戏 TTS 意义不大。
为了节约 Token，可以在生成游戏语音时，批量预生成。
