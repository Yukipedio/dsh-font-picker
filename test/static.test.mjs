// Package-level checks: manifest, display metadata, detail document, preview
// image, icon and changelog.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../', import.meta.url)
const read = (relative) => readFileSync(fileURLToPath(new URL(relative, ROOT)), 'utf8')
const pkg = JSON.parse(read('package.json'))

test('manifest declares the bundle, client half and test entry', () => {
  assert.equal(pkg.name, 'dsh-font-picker')
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.exports['.'], './index.js')
  assert.equal(pkg.exports['./client'], './client.js')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-theme'))
  assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-locale'))
  assert.equal(pkg.engines.dsh, '>=0.2.2-rc.5')
  assert.match(pkg.scripts.test, /node --test .*test/)
  for (const entry of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'locale/*.json', 'docs', 'CHANGELOG.md']) {
    assert.ok(pkg.files.includes(entry), `files must include ${entry}`)
  }
})

test('locale metadata carries title, description and a detail document', () => {
  for (const locale of ['en', 'zh']) {
    const meta = JSON.parse(read(`locale/${locale}.json`)).meta
    assert.ok(meta.title && meta.title.length > 1)
    assert.ok(meta.description && meta.description.length > 10)
    assert.match(meta.detail, /^docs\/DETAIL[^/]*\.md$/)
    assert.ok(existsSync(fileURLToPath(new URL(meta.detail, ROOT))), `missing detail document ${meta.detail}`)
  }
})

test('each detail document is exactly one image line pointing at the preview', () => {
  for (const file of ['docs/DETAIL.md', 'docs/DETAIL.zh.md']) {
    const lines = read(file).split(/\r?\n/u).filter((line) => line.trim() !== '')
    assert.equal(lines.length, 1, `${file} must hold one image line`)
    assert.match(lines[0], /^!\[[^\]]+\]\(preview\.svg\)$/u, `${file} must reference preview.svg`)
  }
})

test('preview SVG is self-contained, 640x300 and text free', () => {
  const svg = read('docs/preview.svg')
  assert.ok(svg.trimStart().startsWith('<svg'))
  assert.match(svg, /width="640"/u)
  assert.match(svg, /height="300"/u)
  assert.match(svg, /viewBox="0 0 640 300"/u)
  for (const forbidden of ['<text', '<script', '<foreignObject', '<style', '<animate', 'href="http']) {
    assert.ok(!svg.includes(forbidden), `preview must not contain ${forbidden}`)
  }
  assert.ok(Buffer.byteLength(svg) < 1024 * 1024)
})

test('icon is a valid SVG below the size limit', () => {
  const icon = read('icon.svg')
  assert.ok(icon.trimStart().startsWith('<svg'))
  assert.ok(statSync(fileURLToPath(new URL('icon.svg', ROOT))).size < 256 * 1024)
})

test('changelog documents every released version', () => {
  const changelog = read('CHANGELOG.md')
  for (const version of ['2.0.0', '2.1.0', '2.2.0', '2.2.1', pkg.version]) {
    assert.ok(changelog.includes(`## ${version}`), `changelog missing ${version}`)
  }
})
