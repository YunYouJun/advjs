/**
 * Browser-safe entry: an OpenAI-compatible chat client and the story session that writes
 * AdvScript one segment at a time. Only `fetch`; no Node built-ins, SDKs or Vue.
 * Node workflows live in `@advjs/ai/node`.
 */
export * from './chat'
export * from './story'
