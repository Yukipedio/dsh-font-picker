/**
 * dsh-font-picker — Host half (v2.1, native-settings mode).
 *
 * DSH 0.2.2+ ships real font settings (Settings → General → Fonts). The picker
 * lists the fonts installed on this machine and writes the picked family into
 * that same settings document; it never overrides CSS.
 *
 * Routes:
 *   GET  /dsh-font-picker/fonts   installed families (name-table parse, cached)
 *   GET  /dsh-font-picker/state   current native font settings + unknown roles
 *   POST /dsh-font-picker/apply   { role, family } -> ui-theme settings
 */

import { open, readdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { execFile } from 'node:child_process'
import os from 'node:os'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const LIST_ROUTE = '/dsh-font-picker/fonts'
const STATE_ROUTE = '/dsh-font-picker/state'
const APPLY_ROUTE = '/dsh-font-picker/apply'

const ROLES = ['text', 'code', 'terminal']
const FIELDS = {
  text: 'textFontFamily',
  code: 'codeFontFamily',
  terminal: 'terminalFontFamily',
}

const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math',
  'fangsong', '-apple-system', 'blinkmacsystemfont',
])

const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.ttc'])
const MAX_TTC_FACES = 64

const DEFAULTS = {
  scanSystemFonts: true,
  extraFontDirs: [],
}

/** Decode one name-table record. */
function decodeName(raw, platform) {
  if (platform === 0 || platform === 3) {
    let out = ''
    for (let i = 0; i + 1 < raw.length; i += 2) out += String.fromCharCode(raw.readUInt16BE(i))
    return out
  }
  return raw.toString('latin1')
}

/** First useful name for one nameId set, preferring English then Chinese. */
function pickName(records, ids) {
  for (const nameId of ids) {
    const found = records.filter((record) => record.nameId === nameId)
    if (found.length === 0) continue
    const en = found.find((record) => record.platform === 3 && record.language === 0x0409) || found.find((record) => record.platform === 0)
    const zh = found.find((record) => record.platform === 3 && [0x0804, 0x0404, 0x1004, 0x0c04].includes(record.language))
    const chosen = en || zh || found[0]
    const value = decodeName(chosen.raw, chosen.platform).trim()
    const zhValue = zh ? decodeName(zh.raw, zh.platform).trim() : ''
    if (value !== '') return { value, zh: zhValue }
  }
  return undefined
}

/** Bounded read from an open file handle. */
async function readRange(handle, offset, length) {
  const buffer = Buffer.alloc(length)
  const { bytesRead } = await handle.read(buffer, 0, length, offset)
  return buffer.subarray(0, bytesRead)
}

/** Parse one SFNT face at `tableDir`; returns family/style/weight. */
async function parseFace(handle, tableDir) {
  const header = await readRange(handle, tableDir, 12)
  if (header.length < 12) return undefined
  const signature = header.toString('latin1', 0, 4)
  if (!['\u0000\u0001\u0000\u0000', 'OTTO', 'true', 'typ1'].includes(signature)) return undefined

  const numTables = header.readUInt16BE(4)
  const dir = await readRange(handle, tableDir + 12, numTables * 16)
  const tables = {}
  for (let index = 0; index < numTables; index++) {
    const record = dir.subarray(index * 16, index * 16 + 16)
    if (record.length < 16) break
    tables[record.toString('latin1', 0, 4)] = {
      offset: record.readUInt32BE(8),
      length: record.readUInt32BE(12),
    }
  }

  const nameTable = tables['name']
  if (!nameTable) return undefined
  const nameBuffer = await readRange(handle, nameTable.offset, Math.min(nameTable.length, 300000))
  if (nameBuffer.length < 6) return undefined
  const count = nameBuffer.readUInt16BE(2)
  const stringOffset = nameBuffer.readUInt16BE(4)
  const records = []
  for (let index = 0; index < count; index++) {
    const record = nameBuffer.subarray(6 + index * 12, 6 + index * 12 + 12)
    if (record.length < 12) break
    const length = record.readUInt16BE(8)
    const offset = record.readUInt16BE(10)
    records.push({
      platform: record.readUInt16BE(0),
      language: record.readUInt16BE(4),
      nameId: record.readUInt16BE(6),
      raw: nameBuffer.subarray(stringOffset + offset, stringOffset + offset + length),
    })
  }

  const family = pickName(records, [16, 1])
  if (family === undefined) return undefined
  const subfamily = pickName(records, [17, 2])

  let weight = 400
  const os2 = tables['OS/2']
  if (os2) {
    const weightBytes = await readRange(handle, os2.offset + 4, 2)
    if (weightBytes.length === 2) weight = weightBytes.readUInt16BE(0)
  }

  return { family: family.value, zh: family.zh, subfamily: subfamily ? subfamily.value : '', weight }
}

/** All faces of one font file (a ttc may contain several). */
async function parseFontFaces(file) {
  const handle = await open(file, 'r')
  try {
    const header = await readRange(handle, 0, 12)
    if (header.length < 12) return []
    if (header.toString('latin1', 0, 4) === 'ttcf') {
      const numFonts = header.readUInt32BE(8)
      const offsets = await readRange(handle, 12, 4 * Math.min(Math.max(numFonts, 0), MAX_TTC_FACES))
      const faces = []
      for (let index = 0; index + 4 <= offsets.length; index += 4) {
        const meta = await parseFace(handle, offsets.readUInt32BE(index))
        if (meta !== undefined) faces.push(meta)
      }
      return faces
    }
    const meta = await parseFace(handle, 0)
    return meta === undefined ? [] : [meta]
  } finally {
    await handle.close()
  }
}

/** Candidate font directories for the current platform. */
function platformFontDirs() {
  const home = os.homedir()
  if (process.platform === 'win32') {
    const windir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows'
    const localAppData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')
    return [
      { dir: join(windir, 'Fonts'), source: 'system' },
      { dir: join(localAppData, 'Microsoft', 'Windows', 'Fonts'), source: 'user' },
    ]
  }
  if (process.platform === 'darwin') {
    return [
      { dir: '/System/Library/Fonts', source: 'system' },
      { dir: '/System/Library/Fonts/Supplemental', source: 'system' },
      { dir: '/Library/Fonts', source: 'system' },
      { dir: join(home, 'Library', 'Fonts'), source: 'user' },
    ]
  }
  return [
    { dir: join(home, '.fonts'), source: 'user' },
    { dir: join(home, '.local', 'share', 'fonts'), source: 'user' },
    { dir: '/usr/local/share/fonts', source: 'system' },
    { dir: '/usr/share/fonts', source: 'system' },
  ]
}

/** Existing font directories for this profile, deduplicated. */
async function resolveFontDirs(options) {
  const candidates = []
  if (options.scanSystemFonts) candidates.push(...platformFontDirs())
  for (const extra of options.extraFontDirs) candidates.push({ dir: extra, source: 'custom' })
  const seen = new Set()
  const dirs = []
  for (const entry of candidates) {
    const key = entry.dir.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    try {
      const info = await stat(entry.dir)
      if (info.isDirectory()) dirs.push(entry)
    } catch {}
  }
  return dirs
}

/** How deep nested font directories are walked (Linux ships fonts in subfolders). */
const MAX_FONT_DIR_DEPTH = 3

/** All font files below one root directory, with the root's read error, if any. */
async function collectFontFiles(root) {
  const files = []
  let error
  const visit = async (dir, depth) => {
    let directoryEntries
    try {
      directoryEntries = await readdir(dir, { withFileTypes: true })
    } catch (cause) {
      if (depth === 0) error = cause && cause.code ? cause.code : String(cause)
      return
    }
    for (const directoryEntry of directoryEntries) {
      if (directoryEntry.isSymbolicLink()) continue
      const full = join(dir, directoryEntry.name)
      if (directoryEntry.isDirectory()) {
        if (depth < MAX_FONT_DIR_DEPTH) await visit(full, depth + 1)
        continue
      }
      if (!directoryEntry.isFile()) continue
      if (!FONT_EXTENSIONS.has(extname(directoryEntry.name).toLowerCase())) continue
      files.push(full)
    }
  }
  await visit(root, 0)
  return { files, error }
}


/** File basenames registered as installed fonts in the Windows registry. */
async function readRegisteredFontFiles() {
  const files = new Set()
  if (process.platform !== 'win32') return files
  const keys = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
    'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
  ]
  for (const key of keys) {
    try {
      const { stdout } = await execFileAsync('reg', ['query', key], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 })
      for (const line of stdout.split(/\r?\n/u)) {
        const match = /REG_(?:SZ|EXPAND_SZ)\s+(.+?)\s*$/u.exec(line)
        if (match === null) continue
        const value = match[1].trim()
        const file = value.split(/[\\/]/u).pop()
        if (file !== undefined && file !== '') files.add(file.toLowerCase())
      }
    } catch {}
  }
  return files
}

/** Scan every configured directory and merge faces by family. */
async function scanFonts(options) {
  const dirs = await resolveFontDirs(options)
  const registeredFiles = await readRegisteredFontFiles()
  const seenFiles = new Set()
  const families = new Map()
  const errors = []
  let scanned = 0
  let faces = 0
  let skipped = 0
  let registeredFilesSeen = 0

  for (const entry of dirs) {
    const collected = await collectFontFiles(entry.dir)
    if (collected.error !== undefined) {
      errors.push({ dir: entry.dir, message: collected.error })
      continue
    }
    for (const file of collected.files) {
      const fileKey = file.toLowerCase()
      if (seenFiles.has(fileKey)) continue
      seenFiles.add(fileKey)
      const fileBase = basename(file).toLowerCase()
      const registered = registeredFiles.has(fileBase)
      if (registered) registeredFilesSeen += 1
      let metas = []
      try {
        metas = await parseFontFaces(file)
      } catch {
        metas = []
      }
      if (metas.length === 0) {
        skipped += 1
        continue
      }
      scanned += 1
      faces += metas.length
      for (const meta of metas) {
        const familyKey = meta.family.toLowerCase()
        let group = families.get(familyKey)
        if (group === undefined) {
          group = {
            family: meta.family,
            zh: meta.zh && meta.zh.toLowerCase() !== meta.family.toLowerCase() ? meta.zh : '',
            weights: new Set(),
            styles: new Set(),
            sources: new Set(),
            files: [],
            registered: false,
          }
          families.set(familyKey, group)
        }
        if (group.zh === '' && meta.zh && meta.zh.toLowerCase() !== meta.family.toLowerCase()) group.zh = meta.zh
        group.weights.add(meta.weight)
        if (meta.subfamily !== '') group.styles.add(meta.subfamily)
        group.sources.add(entry.source)
        if (group.files.length < 6) group.files.push(basename(file))
        if (registered) group.registered = true
      }
    }
  }

  const list = Array.from(families.values())
    .map((group) => ({
      family: group.family,
      zh: group.zh,
      weights: Array.from(group.weights).sort((left, right) => left - right),
      styles: Array.from(group.styles).slice(0, 4),
      sources: Array.from(group.sources),
      files: group.files,
      registered: group.registered,
    }))
    .sort((left, right) => left.family.localeCompare(right.family))

  return { list, scanned, faces, skipped, errors, dirs: dirs.map((entry) => entry.dir), registered: registeredFilesSeen }
}

/** Normalize one family into the stored list form. */
function normalizeFamily(name) {
  const cleaned = String(name ?? '')
    .replace(/["'\\<>\u0000-\u001f\u007f]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
  if (cleaned === '') return ''
  return GENERIC_FAMILIES.has(cleaned.toLowerCase()) ? cleaned : `"${cleaned}"`
}

/** Strip quotes and surrounding whitespace from a stored family list's first entry. */
function firstFamilyName(value) {
  const first = String(value ?? '').split(',')[0] ?? ''
  return first.replace(/["']/gu, '').trim()
}

/** Whether `name` names this installed family (English or localized). */
function familyMatches(font, name) {
  const target = String(name ?? '').replace(/["'\\]/gu, '').trim().toLowerCase()
  if (target === '') return true
  return font.family.toLowerCase() === target || (font.zh !== '' && font.zh.toLowerCase() === target)
}

/** The live ui-theme settings descriptor. */
function findThemeEntry(settings) {
  let descriptors
  try {
    descriptors = settings.describe()
  } catch {
    return undefined
  }
  return descriptors.find((descriptor) => {
    const value = descriptor.value
    return value !== null && typeof value === 'object' && typeof value.textFontFamily === 'string'
  })
}

/** role -> stored family list map. */
function currentFamilies(entry) {
  const value = entry !== undefined && entry.value !== null && typeof entry.value === 'object' ? entry.value : {}
  const result = {}
  for (const role of ROLES) result[role] = typeof value[FIELDS[role]] === 'string' ? value[FIELDS[role]] : ''
  return result
}

/** Read a bounded JSON body. */
async function readJsonBody(req, limit = 8192) {
  return await new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch {
        reject(new Error('request body is not valid JSON'))
      }
    })
    req.on('error', reject)
  })
}

/** JSON response with hardening headers. */
function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(JSON.stringify(payload))
}

/** Reject cross-origin writes; same-origin browser requests and CLI tools pass. */
function isCrossOrigin(req) {
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin === '') return false
  try {
    const parsed = new URL(origin)
    return parsed.host !== req.headers.host
  } catch {
    return true
  }
}

export const inject = ['webServer']

export function apply(ctx, config) {
  const raw = config !== null && typeof config === 'object' ? config : {}
  const options = {
    scanSystemFonts: raw.scanSystemFonts === undefined ? DEFAULTS.scanSystemFonts : raw.scanSystemFonts !== false,
    extraFontDirs: Array.isArray(raw.extraFontDirs)
      ? raw.extraFontDirs.filter((item) => typeof item === 'string' && item.trim() !== '').map((item) => item.trim())
      : DEFAULTS.extraFontDirs.slice(),
  }

  let cache = { at: 0, data: null }
  const CACHE_MS = 120000

  async function getFonts(force) {
    const now = Date.now()
    if (!force && cache.data !== null && now - cache.at < CACHE_MS) return cache.data
    const data = await scanFonts(options)
    cache = { at: now, data }
    return data
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: LIST_ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405
        res.setHeader('allow', 'GET, HEAD')
        res.end()
        return
      }
      try {
        const url = new URL(req.url, 'http://127.0.0.1')
        const data = await getFonts(url.searchParams.get('refresh') === '1')
        sendJson(res, 200, {
          count: data.list.length,
          families: data.list,
          scanned: data.scanned,
          faces: data.faces,
          skipped: data.skipped,
          registered: data.registered,
          errors: data.errors,
          dirs: data.dirs,
        })
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: STATE_ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405
        res.setHeader('allow', 'GET, HEAD')
        res.end()
        return
      }
      const settings = ctx.get('settings')
      if (settings === undefined) {
        sendJson(res, 503, { error: 'settings service is not available' })
        return
      }
      const entry = findThemeEntry(settings)
      if (entry === undefined) {
        sendJson(res, 503, { error: 'ui-theme settings entry was not found' })
        return
      }
      try {
        const data = await getFonts(false)
        const families = currentFamilies(entry)
        const unknownRoles = ROLES.filter((role) => {
          const first = firstFamilyName(families[role])
          return first !== '' && !data.list.some((font) => familyMatches(font, first))
        })
        sendJson(res, 200, { fontFamilies: families, unknownRoles, count: data.list.length, errors: data.errors })
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: APPLY_ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('allow', 'POST')
        res.end()
        return
      }
      if (isCrossOrigin(req)) {
        sendJson(res, 403, { error: 'cross-origin writes are not allowed' })
        return
      }
      let body
      try {
        body = await readJsonBody(req)
      } catch (error) {
        sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        return
      }
      const role = body && typeof body.role === 'string' ? body.role : ''
      if (!ROLES.includes(role)) {
        sendJson(res, 400, { error: 'role must be one of text, code, terminal' })
        return
      }
      if (body.family !== undefined && typeof body.family !== 'string') {
        sendJson(res, 400, { error: 'family must be a string' })
        return
      }
      const requested = body.family === undefined ? '' : body.family.trim()
      if (requested.length > 200) {
        sendJson(res, 400, { error: 'family is too long' })
        return
      }

      const settings = ctx.get('settings')
      if (settings === undefined) {
        sendJson(res, 503, { error: 'settings service is not available; cannot write native font settings' })
        return
      }
      const entry = findThemeEntry(settings)
      if (entry === undefined) {
        sendJson(res, 503, { error: 'ui-theme settings entry was not found; DSH may be too old for native font settings' })
        return
      }

      let fonts
      try {
        fonts = await getFonts(false)
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        return
      }
      if (requested !== '' && !fonts.list.some((font) => familyMatches(font, requested))) {
        sendJson(res, 422, { error: 'font family is not installed on this machine', family: requested })
        return
      }

      const family = normalizeFamily(requested)
      try {
        await settings.update(entry.ns, { [FIELDS[role]]: family })
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        return
      }
      sendJson(res, 200, { ok: true, role, family, fontFamilies: currentFamilies(findThemeEntry(settings)) })
    },
  }))
}
