---
title: Privacy Policy
description: How ADV.JS Studio handles your data
---

# ADV.JS Studio Privacy Policy

_Last updated: 2026-08-14_

ADV.JS Studio ("the App", "we") is an open-source visual novel creation tool published by the ADV.JS project. This page explains what data the App handles, where it lives, and what choices you have. The App is also available as a website at [studio.advjs.org](https://studio.advjs.org); the same policy applies to both the iOS app and the web app.

## TL;DR

- **Your project files stay on your device by default.** Stories, characters, scenes, and asset references live in your chosen local workspace or the app's local storage unless you explicitly use a hosted feature.
- **Studio AI is a managed service.** A signed-in AI task sends only the capability-specific saved project files needed for that request to the ADV.JS AI Runtime and its server-selected model provider.
- **Studio production does not ask for or store model-provider API keys.** Legacy browser BYOK data is deleted locally during upgrade without being read or uploaded. Use the local Editor workflow when you want to manage your own provider.
- **Anonymous telemetry is OFF by default.** You can turn it on in `Me → Privacy` if you want to help us improve the app.

## 1. Data the App stores on your device

The App stores the following on-device:

| Data                                                       | Location                                                      | Purpose                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------- |
| Project content (chapters, characters, scenes, audio refs) | Local workspace / IndexedDB / Documents folder                | Your visual novel projects               |
| App preferences (theme, language, layout)                  | localStorage                                                  | Personalization                          |
| Managed task UI state and resumable cursor                 | App state; authoritative task state is on the managed Runtime | Resume task progress and show settlement |
| Telemetry queue (only if telemetry is on)                  | localStorage (`advjs-studio:telemetry-queue`)                 | Buffer events until next flush           |

Clearing your browser data (web) or deleting the app (iOS) removes all of the above.

## 2. Data sent off your device

### 2.1 Managed AI service

Studio's production AI features use the ADV.JS managed Runtime. The App sends the selected capability, semantic inputs, a project revision, and only the saved project files allowed for that capability. The Runtime chooses the model provider, enforces safety and usage limits, records task status and token usage, and settles AI points.

Generated output is returned as task results or reviewable proposals. A proposal does not modify your project until you explicitly apply it. Do not place credentials or secrets in project content you submit to a managed AI task.

General chat, character chat, image generation, cloud TTS, managed ASR, content extraction, and remote embeddings are disabled until they have a registered managed capability. Studio does not silently fall back to direct browser calls. See [Studio managed AI and local Editor boundary](/guide/studio/ai-service).

### 2.2 Optional cloud sync

Hosted asset publishing uses account authentication and a short-lived, single-object upload URL. The browser does not receive a permanent COS SecretId/SecretKey. Project source sync and binary asset publishing are separate features.

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

If you sign in through YunLeFun SSO, the Studio session is adopted by CloudBase Auth. Account identity is used for managed AI tasks, AI point settlement, and community features. Opening and editing a supported local project remains available without starting an AI task.

## 3. Tracking

The App does **not** use any third-party analytics, advertising SDKs, or cross-site tracking. There are no cookies set by us beyond what's required for the optional account session.

## 4. Children

The App is not directed at children under 13. We do not knowingly collect personal information from children.

## 5. Your choices

- **Turn telemetry on / off**: `Me → Privacy → Allow anonymous telemetry`
- **Clear all local data**: `Me → Settings → Clear Cache`
- **Clear pending telemetry queue**: `Me → Privacy → Clear pending telemetry queue`
- **Delete your account** (if signed in): contact us at the email below
- **Review AI service status and points**: `Me → Settings → AI Service`

## 6. Security

Studio production does not persist provider API keys. On startup, it removes the legacy `advjs-studio-ai` localStorage entry without reading, parsing, logging, or uploading it. Provider credentials used with local Editor tooling should stay in that tool's protected configuration or operating-system environment and must not be committed into an ADV.JS project.

## 7. Open source

ADV.JS Studio is open source under the MPL-2.0 license. You can audit exactly what data is collected and where it is sent in the [GitHub repository](https://github.com/YunYouJun/advjs).

## 8. Changes to this policy

We will update this page when behavior changes. The "Last updated" date at the top reflects the most recent revision.

## 9. Contact

Questions about this policy: <https://github.com/YunYouJun/advjs/issues>
