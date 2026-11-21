// Open-source packaging checks: metadata, licence, CI, multilingual READMEs and
// a privacy sweep that keeps machine-specific paths out of the repository.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

const ROOT_URL = new URL('../', import.meta.url)
const ROOT = fileURLToPath(ROOT_URL)
const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, ROOT_URL)), 'utf8')
const pkg = JSON.parse(read('package.json'))

test('npm metadata is ready for a public release', () => {
  assert.equal(pkg.private, undefined, 'private must be removed before publishing')
  assert.equal(pkg.license, 'MIT')
  assert.equal(pkg.publishConfig.access, 'public')
  assert.match(pkg.repository.url, /github\.com\/.+\/dsh-font-picker(\.git)?$/u)
  assert.match(pkg.homepage, /^https:\/\/github\.com\//u)
  assert.match(pkg.bugs.url, /\/issues$/u)
  assert.ok(pkg.keywords.includes('dsh-plugin'))
  assert.ok(pkg.engines.node)
  for (const file of ['LICENSE', 'README.md', 'README.en.md', 'README.ja.md', 'CHANGELOG.md', '.gitignore', '.github/workflows/ci.yml']) {
    assert.ok(statSync(join(ROOT, file)).isFile(), `missing ${file}`)
  }
})

test('LICENSE is the full MIT text', () => {
  const license = read('LICENSE')
  assert.match(license, /MIT License/u)
  assert.match(license, /Permission is hereby granted/u)
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/u)
  assert.match(license, /Copyright \(c\) 2026 dsh-font-picker contributors/u)
})

test('CI runs the test suite on Windows, macOS and Linux', () => {
  const workflow = read('.github/workflows/ci.yml')
  for (const os of ['ubuntu-latest', 'windows-latest', 'macos-latest']) {
    assert.ok(workflow.includes(os), `CI missing ${os}`)
  }
  assert.match(workflow, /node --test/u)
})

test('READMEs exist in the requested languages', () => {
  const zh = read('README.md')
  const en = read('README.en.md')
  const ja = read('README.ja.md')
  assert.match(zh, /[\u4e00-\u9fff]/u, 'README.md must be Chinese')
  assert.match(en, /Installation/u, 'README.en.md must be English')
  assert.match(ja, /インストール/u, 'README.ja.md must be Japanese')
  for (const text of [zh, en, ja]) {
    assert.ok(text.includes('dsh-font-picker'))
    assert.ok(text.includes('MIT'))
  }
})

test('repository contains no machine-specific user paths', () => {
  const offenders = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'coverage') continue
      // The privacy checker itself contains the pattern it looks for.
      if (entry.name === 'oss.test.mjs') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(m?js|json|md|ya?ml|svg|txt|patch)$/u.test(entry.name)) continue
      const text = readFileSync(full, 'utf8')
      if (text.includes('yukip') || /C:\\\\Users\\\\[A-Za-z0-9._-]+/u.test(text)) {
        offenders.push(relative(ROOT, full))
      }
    }
  }
  walk(ROOT)
  assert.deepEqual(offenders, [], `machine-specific paths found in: ${offenders.join(', ')}`)
})

test('font discovery covers Windows, macOS and Linux directories', () => {
  const host = read('index.js')
  for (const fragment of [
    "process.platform === 'win32'",
    "process.platform === 'darwin'",
    "'/System/Library/Fonts'",
    "'/Library/Fonts'",
    "'/usr/local/share/fonts'",
    "'/usr/share/fonts'",
    "'.local', 'share', 'fonts'",
  ]) {
    assert.ok(host.includes(fragment), `index.js is missing ${fragment}`)
  }
})
