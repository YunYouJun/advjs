---
title: Privacy Policy
description: How ADV.JS Studio handles your data
---

# ADV.JS Studio Privacy Policy

_Last updated: 2025-05-31_

ADV.JS Studio ("the App", "we") is an open-source visual novel creation tool published by the ADV.JS project. This page explains what data the App handles, where it lives, and what choices you have. The App is also available as a website at [studio.advjs.org](https://studio.advjs.org); the same policy applies to both the iOS app and the web app.

## TL;DR

- **All your project data stays on your device by default.** Stories, characters, scenes, dialogues, and AI chat history live in your browser's IndexedDB / localStorage, or — when running as the iOS app — in the app's `Documents/` folder.
- **We do not have a server that stores your projects.** Cloud sync is optional and uses **your own** Tencent COS bucket / CloudBase environment, configured by you.
- **Third-party AI providers are called directly from your device using API keys you supply.** We never see those keys or the prompts you send.
- **Anonymous telemetry is OFF by default.** You can turn it on in `Me → Privacy` if you want to help us improve the app.

## 1. Data the App stores on your device

The App stores the following on-device:

| Data                                                                                           | Location                                      | Purpose                                        |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| Project content (chapters, characters, scenes, audio refs)                                     | IndexedDB / Documents folder                  | Your visual novel projects                     |
| App preferences (theme, language, layout)                                                      | localStorage                                  | Personalization                                |
| **AI provider API keys** (DeepSeek, OpenAI, OpenRouter, SiliconFlow, custom OpenAI-compatible) | localStorage (`advjs-studio-ai`)              | Direct calls to the AI provider you configured |
| TTS / Embedding keys                                                                           | localStorage (`advjs-studio-ai`)              | Same as above                                  |
| Telemetry queue (only if telemetry is on)                                                      | localStorage (`advjs-studio:telemetry-queue`) | Buffer events until next flush                 |

Clearing your browser data (web) or deleting the app (iOS) removes all of the above.

## 2. Data sent off your device

### 2.1 Third-party AI providers

When you call AI features (chat, suggestions, image, TTS, embeddings), the App makes **direct HTTPS requests from your device** to the provider you selected in `Me → Settings → AI`. Your API key, prompts, and responses are subject to that provider's privacy policy:

- DeepSeek — <https://platform.deepseek.com/>
- OpenAI — <https://openai.com/policies/privacy-policy/>
- OpenRouter — <https://openrouter.ai/>
- SiliconFlow — <https://siliconflow.cn/>
- Tencent Hunyuan — <https://cloud.tencent.com/>
- Runware — <https://runware.ai/>

We do **not** proxy these calls and we do **not** see the contents.

In a future release, signed-in users may purchase prepaid credits to use a hosted proxy without configuring their own keys. When that ships, this section will be updated to describe what the proxy logs and retains, and the feature will be opt-in.

### 2.2 Optional cloud sync

If — and only if — you set up Cloud Sync in `Me → Settings → Cloud Sync`, the App uploads your project files to **your** Tencent COS bucket using credentials you provide. We never receive those credentials.

### 2.3 Anonymous telemetry (opt-in, OFF by default)

If you toggle telemetry ON in `Me → Privacy`, the App sends anonymous usage events to our self-hosted CloudBase function (`advjs-telemetry`):

**What we collect:**

- Aggregated UI events (page view, button click)
- Crash stack traces and uncaught Promise rejections (with long fields truncated)
- App version, language, platform metadata
- A random session id (regenerated every session, not tied to your account)

**What we never collect:**

- Project content, chapter text, character cards
- AI prompts, AI responses, conversation history
- API keys, login credentials, email, phone number, user-id
- File paths beyond the relative `adv/` subfolder

You can disable telemetry at any time in `Me → Privacy`. Disabling deletes the local queue and stops further uploads.

### 2.4 Account features (optional)

If you sign in to the optional ADV.JS account (CloudBase auth), we store your user-id, masked phone, display name, and avatar URL on our server. Sign-in is only required for community features (publishing to the marketplace, follow / notifications). The core editor works fully without an account.

## 3. Tracking

The App does **not** use any third-party analytics, advertising SDKs, or cross-site tracking. There are no cookies set by us beyond what's required for the optional account session.

## 4. Children

The App is not directed at children under 13. We do not knowingly collect personal information from children.

## 5. Your choices

- **Turn telemetry on / off**: `Me → Privacy → Allow anonymous telemetry`
- **Clear all local data**: `Me → Settings → Clear Cache`
- **Clear pending telemetry queue**: `Me → Privacy → Clear pending telemetry queue`
- **Delete your account** (if signed in): contact us at the email below
- **Configure or disable cloud sync**: `Me → Settings → Cloud Sync`

## 6. Security

API keys live in `localStorage`, which is sandboxed per origin (web) or per app (iOS). We recommend:

- Use API keys with the lowest possible scope (e.g. per-project DeepSeek key)
- Rotate keys periodically
- Don't share device passcodes with anyone you wouldn't trust with your projects

## 7. Open source

ADV.JS Studio is open source under the MPL-2.0 license. You can audit exactly what data is collected and where it is sent in the [GitHub repository](https://github.com/YunYouJun/advjs).

## 8. Changes to this policy

We will update this page when behavior changes. The "Last updated" date at the top reflects the most recent revision.

## 9. Contact

Questions about this policy: <https://github.com/YunYouJun/advjs/issues>
