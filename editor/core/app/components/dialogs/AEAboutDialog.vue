<script setup lang="ts">
import { Toast } from '@advjs/gui'

import dayjs from 'dayjs'
import { UAParser } from 'ua-parser-js'
import advjsPkg from '@/../../../packages/advjs/package.json'

import pkg from '@/../package.json'
import { links } from '../../../../../packages/shared/src'

const open = defineModel('open', {
  type: Boolean,
  default: false,
})

const uaResult = UAParser(navigator.userAgent)

const browserName = uaResult.browser.name?.toLowerCase()
const buildTime = dayjs(Number.parseInt(import.meta.env.VITE_APP_BUILD_TIME)).format('YYYY-MM-DD HH:mm:ss')
const latestCommitHash = import.meta.env.VITE_APP_LATEST_COMMIT_HASH

const githubCommitUrl = `${links.github}/commit/${latestCommitHash}`

const source = ref(uaResult.ua)
const { copy, copied } = useClipboard({ source })

async function copyUA() {
  await copy(uaResult.ua)
  if (copied.value) {
    // show toast
    Toast({
      title: 'Success',
      description: 'User-Agent copied to clipboard',
      type: 'success',
    })
    open.value = false
  }
}

/**
 * 拷贝环境信息 for debug
 */
async function copyDebugEnv() {
  const debugEnvTxt = `ADV.JS Editor
Version: ${pkg.version} (advjs@${advjsPkg.version})
Build Time: ${buildTime}
Commit: ${latestCommitHash}

Browser: ${uaResult.browser.name} ${uaResult.browser.version}
Device: ${uaResult.device.vendor} ${uaResult.device.model}${uaResult.device.type ? ` (${uaResult.device.type})` : ''}
Engine: ${uaResult.engine.name} ${uaResult.engine.version}
OS: ${uaResult.os.name} ${uaResult.os.version}${uaResult.cpu.architecture ? ` (${uaResult.cpu.architecture})` : ''}
User-Agent: ${uaResult.ua}`
  await copy(debugEnvTxt)
  if (copied.value) {
    // show toast
    Toast({
      title: 'Success',
      description: 'Debug env info copied to clipboard',
      type: 'success',
    })
    open.value = false
  }
}
</script>

<template>
  <AGUIDialog v-model:open="open" title="About" content-class="w-md">
    <div class="flex flex-col gap-1 p-4">
      <table class="w-full text-center" cellpadding="8">
        <caption class="p-2">
          <h3 class="flex items-center justify-center text-2xl font-bold">
            ADV.JS Editor
          </h3>
          <div class="flex items-center justify-center gap-2 text-xs op-50">
            <span>{{ buildTime }}</span>
            <a :href="githubCommitUrl" target="_blank" class="text-blue-200 underline hover:text-blue-400">
              {{ latestCommitHash.substring(0, 7) }}
            </a>
          </div>
        </caption>
        <thead>
          <tr>
            <th scope="col" align="right">
              ADV.JS Editor
            </th>
            <th scope="col" align="left">
              {{ pkg.version }}
              (advjs@{{ advjsPkg.version }})
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" align="right">
              Browser
            </th>
            <td align="left">
              <span class="inline-flex items-center justify-center gap-1">
                <div v-if="browserName === 'chrome'" class="i-ri-chrome-line" />
                <div v-else-if="browserName === 'firefox'" class="i-ri-firefox-line" />
                <div v-else-if="browserName === 'safari'" class="i-ri-safari-line" />
                <div v-else-if="browserName === 'edge'" class="i-ri-edge-line" />
                {{ uaResult.browser.name }} {{ uaResult.browser.version }}
              </span>
            </td>
          </tr>
          <tr v-if="uaResult.cpu.architecture">
            <th scope="row" align="right">
              CPU
            </th>
            <td align="left">
              <span class="inline-flex items-center justify-center gap-1">
                <div class="i-ri-cpu-line" />
                {{ uaResult.cpu.architecture }}
              </span>
            </td>
          </tr>
          <tr>
            <th scope="row" align="right">
              Device
            </th>
            <td align="left">
              <span class="inline-flex items-center justify-center gap-1">
                <div class="i-ri-device-line" />
                {{ uaResult.device.vendor }} {{ uaResult.device.model }}
                {{ uaResult.device.type }}
              </span>
            </td>
          </tr>
          <tr>
            <th scope="row" align="right">
              Engine
            </th>
            <td align="left">
              <span class="inline-flex items-center justify-center gap-1">
                {{ uaResult.engine.name }} {{ uaResult.engine.version }}
              </span>
            </td>
          </tr>
          <tr>
            <th scope="row" align="right">
              OS
            </th>
            <td align="left">
              <span class="inline-flex items-center justify-center gap-1">
                <div class="i-ri-terminal-line" />
                {{ uaResult.os.name }} {{ uaResult.os.version }}
              </span>
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr>
            <th scope="row" colspan="2">
              <code class="text-xs op-50">
                {{ uaResult.ua }}
              </code>
            </th>
          </tr>
        </tfoot>
      </table>

      <div class="flex items-center justify-center gap-2">
        <t-button theme="default" class="font-bold" size="small" @click="copyUA">
          Copy User Agent
        </t-button>
        <t-button theme="default" class="font-bold" size="small" @click="copyDebugEnv">
          Copy Debug Env
        </t-button>
      </div>
    </div>
  </AGUIDialog>
</template>
