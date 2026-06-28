import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
const DATA_FILE = join(DATA_DIR, 'quota.json')

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

export function readStore() {
  ensureDir()
  if (!existsSync(DATA_FILE)) return { devices: {} }
  try {
    const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
    return parsed?.devices ? parsed : { devices: {} }
  } catch {
    return { devices: {} }
  }
}

export function writeStore(data) {
  ensureDir()
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 0), 'utf8')
}
