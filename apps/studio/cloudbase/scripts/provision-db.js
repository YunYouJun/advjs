/**
 * Provision the Story Market CloudBase backend: create the marketplace
 * collections and apply their version-controlled security rules.
 *
 * Idempotent — safe to re-run. Collections are auto-discovered from the sibling
 * `../security-rules/*.json` files: one file per collection, where the filename
 * (minus `.json`) is the collection name and the contents are the classic
 * safe-rule JSON, applied as a CUSTOM resource permission.
 *
 * Usage:
 *   cd apps/studio/cloudbase/scripts
 *   npm install
 *   node provision-db.js [envId]
 *
 * envId resolution:   argv[2] → $VITE_TCB_ENV_ID → ../cloudbaserc.json "envId".
 * Credentials:        $TENCENTCLOUD_SECRETID + $TENCENTCLOUD_SECRETKEY
 *                     (+ optional $TENCENTCLOUD_SESSIONTOKEN for STS), else the
 *                     CloudBase CLI login at ~/.config/.cloudbase/auth.json
 *                     (run `tcb login` first).
 *
 * Deploy the `marketStats` cloud function separately — see ../README.md §4.
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const process = require('node:process')
const CloudBase = require('@cloudbase/manager-node')

const RULES_DIR = path.resolve(__dirname, '../security-rules')

function resolveEnvId() {
  if (process.argv[2])
    return process.argv[2]
  if (process.env.VITE_TCB_ENV_ID)
    return process.env.VITE_TCB_ENV_ID
  try {
    const rc = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../cloudbaserc.json'), 'utf8'))
    if (rc.envId)
      return rc.envId
  }
  catch {}
  throw new Error('envId not provided — pass as arg, set $VITE_TCB_ENV_ID, or add it to cloudbaserc.json')
}

function resolveCredentials() {
  const { TENCENTCLOUD_SECRETID, TENCENTCLOUD_SECRETKEY, TENCENTCLOUD_SESSIONTOKEN } = process.env
  if (TENCENTCLOUD_SECRETID && TENCENTCLOUD_SECRETKEY)
    return { secretId: TENCENTCLOUD_SECRETID, secretKey: TENCENTCLOUD_SECRETKEY, token: TENCENTCLOUD_SESSIONTOKEN }
  const authPath = path.join(os.homedir(), '.config/.cloudbase/auth.json')
  const cred = JSON.parse(fs.readFileSync(authPath, 'utf8')).credential
  if (!cred || !cred.tmpSecretId)
    throw new Error('No credentials — set $TENCENTCLOUD_SECRETID/$TENCENTCLOUD_SECRETKEY or run `tcb login`')
  return { secretId: cred.tmpSecretId, secretKey: cred.tmpSecretKey, token: cred.tmpToken }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function main() {
  const envId = resolveEnvId()
  const init = CloudBase.init || (CloudBase.default && CloudBase.default.init)
  const app = init({ ...resolveCredentials(), envId })

  const files = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.json')).sort()
  console.log(`Provisioning ${files.length} collections on ${envId}:\n`)

  for (const file of files) {
    const name = file.replace(/\.json$/, '')
    const rule = JSON.stringify(JSON.parse(fs.readFileSync(path.join(RULES_DIR, file), 'utf8')))
    try {
      await app.database.createCollectionIfNotExists(name) // idempotent
      await sleep(300)
      await app.permission.modifyResourcePermission({
        resourceType: 'collection',
        resource: name,
        permission: 'CUSTOM',
        securityRule: rule,
      })
      console.log(`  ✓ ${name}  ${rule}`)
    }
    catch (err) {
      console.log(`  ✗ ${name}  ${err.code || ''} ${err.message}`)
      process.exitCode = 1
    }
  }
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
