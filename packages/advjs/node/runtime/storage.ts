import type { RuntimeSaveRecord, RuntimeStorage } from '@advjs/core'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { validateRuntimeSaveRecord } from '@advjs/core'

function filenameForId(id: string): string {
  return `${Buffer.from(id).toString('base64url')}.json`
}

function compareRecords(left: RuntimeSaveRecord, right: RuntimeSaveRecord): number {
  if (left.updatedAt !== right.updatedAt)
    return right.updatedAt - left.updatedAt
  if (left.id < right.id)
    return -1
  if (left.id > right.id)
    return 1
  return 0
}

export function createFileRuntimeStorage(directory: string): RuntimeStorage {
  const ensureDirectory = () => mkdir(directory, { recursive: true })
  const fileForId = (id: string) => join(directory, filenameForId(id))

  const readRecord = async (file: string): Promise<RuntimeSaveRecord> => {
    const content = await readFile(file, 'utf8')
    return validateRuntimeSaveRecord(JSON.parse(content))
  }

  return {
    async list() {
      await ensureDirectory()
      const files = (await readdir(directory)).filter(file => file.endsWith('.json'))
      const records = await Promise.all(files.map(file => readRecord(join(directory, file))))
      return records.sort(compareRecords)
    },
    async get(id) {
      await ensureDirectory()
      try {
        return await readRecord(fileForId(id))
      }
      catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
          return undefined
        throw error
      }
    },
    async set(record) {
      const valid = validateRuntimeSaveRecord(record)
      await ensureDirectory()
      const target = fileForId(valid.id)
      const temporary = join(
        directory,
        `.${filenameForId(valid.id)}.${process.pid}.${randomUUID()}.tmp`,
      )
      try {
        await writeFile(temporary, `${JSON.stringify(valid, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
        await rename(temporary, target)
      }
      finally {
        await rm(temporary, { force: true })
      }
    },
    async remove(id) {
      await ensureDirectory()
      await rm(fileForId(id), { force: true })
    },
  }
}
