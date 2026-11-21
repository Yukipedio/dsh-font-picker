// Host tests for dsh-font-picker: installed-font listing, native settings
// read/write, validation, origin guard and graceful degradation.
//
// The assertions stay portable: they check the response contract first and only
// look at specific families when such a font happens to be installed.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { apply } from '../index.js'

function createSettings(initial = {}) {
  const state = {
    preference: 'system',
    textFontFamily: '',
    codeFontFamily: '',
    terminalFontFamily: '',
    fontSize: 14,
    codeFontSize: 11,
    terminalFontSize: 13,
    ...initial,
  }
  const updates = []
  const settings = {
    describe() {
      return [{
        ns: 'include:ui-theme',
        revision: 1,
        value: { ...state },
        schema: {},
        autoGenerate: false,
        applies: 'live',
      }]
    },
    async update(ns, patch) {
      updates.push({ ns, patch })
      Object.assign(state, patch)
    },
  }
  return { state, updates, settings }
}

function boot(withSettings, settings) {
  const routes = []
  const ctx = {
    effect(fn) {
      fn()
    },
    on() {},
    get(name) {
      if (name === 'settings') return withSettings ? settings : undefined
      return undefined
    },
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
  }
  apply(ctx, { scanSystemFonts: true, extraFontDirs: [] })
  return routes
}

async function withServer(routes, run) {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://x').pathname
    const route = routes.find((item) => item.path === pathname)
    if (route === undefined) {
      res.statusCode = 404
      res.end('no route')
      return
    }
    route.handler(req, res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    return await run(origin)
  } finally {
    server.close()
  }
}

function post(origin, body, headers = {}) {
  return fetch(`${origin}/dsh-font-picker/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function readFonts(origin) {
  const response = await fetch(`${origin}/dsh-font-picker/fonts`)
  assert.equal(response.status, 200)
  return await response.json()
}

function firstFamily(payload) {
  return payload.families.length === 0 ? undefined : payload.families[0].family
}

function firstLocalizedFamily(payload) {
  return payload.families.find((font) => typeof font.zh === 'string' && font.zh !== '')
}

test('registers the three documented routes', () => {
  const { settings } = createSettings()
  const routes = boot(true, settings)
  assert.equal(routes.length, 3)
  assert.deepEqual(routes.map((route) => route.path).sort(), [
    '/dsh-font-picker/apply',
    '/dsh-font-picker/fonts',
    '/dsh-font-picker/state',
  ])
  assert.ok(routes.every((route) => route.kind === 'exact'))
})

test('lists installed font families with a stable response shape', async () => {
  const { settings } = createSettings()
  await withServer(boot(true, settings), async (origin) => {
    const payload = await readFonts(origin)
    assert.equal(typeof payload.count, 'number')
    assert.equal(payload.count, payload.families.length)
    assert.ok(Array.isArray(payload.errors))
    assert.equal(typeof payload.scanned, 'number')
    assert.equal(typeof payload.faces, 'number')
    assert.equal(typeof payload.registered, 'number')
    assert.ok(payload.faces >= payload.scanned)
    assert.ok(Array.isArray(payload.dirs))

    for (const font of payload.families) {
      assert.equal(typeof font.family, 'string')
      assert.ok(Array.isArray(font.weights))
      assert.ok(Array.isArray(font.sources))
      assert.ok(Array.isArray(font.files))
      assert.equal(typeof font.registered, 'boolean')
    }

    if (payload.count > 0) {
      assert.ok(payload.dirs.length > 0, 'a non-empty list must have a readable directory')
      if (process.platform === 'win32') {
        assert.ok(payload.registered > 0, 'Windows fonts should be registered')
      }
      const lxgw = payload.families.find((font) => font.family === 'LXGW WenKai')
      if (lxgw !== undefined) assert.equal(lxgw.zh, '霞鹜文楷')
      const rounded = payload.families.find((font) => font.family === 'Arial Rounded MT Bold')
      if (rounded !== undefined) assert.equal(rounded.registered, true)
    }

    const refreshed = await fetch(`${origin}/dsh-font-picker/fonts?refresh=1`)
    assert.equal(refreshed.status, 200)
  })
})

test('scans the platform font directories', async () => {
  const { settings } = createSettings()
  await withServer(boot(true, settings), async (origin) => {
    const payload = await readFonts(origin)
    if (payload.dirs.length === 0) {
      return
    }
    const normalized = payload.dirs.map((dir) => dir.replace(/\\/g, '/').toLowerCase())
    if (process.platform === 'win32') {
      assert.ok(normalized.some((dir) => dir.endsWith('/fonts')), 'missing the Windows Fonts directory')
    } else if (process.platform === 'darwin') {
      assert.ok(normalized.some((dir) => dir.includes('/system/library/fonts') || dir.includes('/library/fonts')))
    } else {
      assert.ok(normalized.some((dir) => dir.includes('/usr/share/fonts') || dir.includes('/usr/local/share/fonts') || dir.includes('/.fonts') || dir.includes('/.local/share/fonts')))
    }
  })
})

test('state reports current families and unknown roles', async () => {
  const { state, settings } = createSettings()
  await withServer(boot(true, settings), async (origin) => {
    const empty = await (await fetch(`${origin}/dsh-font-picker/state`)).json()
    assert.deepEqual(empty.unknownRoles, [])
    assert.equal(empty.fontFamilies.text, '')

    const payload = await readFonts(origin)
    const known = firstLocalizedFamily(payload) || payload.families[0]
    if (known !== undefined) {
      state.textFontFamily = `"${known.family}"`
      const knownState = await (await fetch(`${origin}/dsh-font-picker/state`)).json()
      assert.deepEqual(knownState.unknownRoles, [])
    }

    state.codeFontFamily = '"Definitely Missing"'
    const missing = await (await fetch(`${origin}/dsh-font-picker/state`)).json()
    assert.ok(missing.unknownRoles.includes('code'))
  })
})

test('apply writes quoted families into ui-theme and reports live state', async () => {
  const { state, updates, settings } = createSettings()
  await withServer(boot(true, settings), async (origin) => {
    const payload = await readFonts(origin)
    const target = firstFamily(payload)
    if (target === undefined) {
      return
    }
    const first = await post(origin, { role: 'text', family: target })
    assert.equal(first.status, 200)
    const body = await first.json()
    assert.equal(body.ok, true)
    assert.equal(body.fontFamilies.text, `"${target}"`)
    assert.equal(state.textFontFamily, `"${target}"`)
    assert.equal(updates.at(-1).ns, 'include:ui-theme')

    const localized = firstLocalizedFamily(payload)
    if (localized !== undefined) {
      const response = await post(origin, { role: 'code', family: localized.zh })
      assert.equal(response.status, 200)
      assert.equal(state.codeFontFamily, `"${localized.zh}"`)
    }

    const reset = await post(origin, { role: 'terminal', family: '' })
    assert.equal(reset.status, 200)
    assert.equal(state.terminalFontFamily, '')
  })
})

test('apply rejects invalid input and unknown families', async () => {
  const { settings } = createSettings()
  await withServer(boot(true, settings), async (origin) => {
    assert.equal((await post(origin, { role: 'nope', family: 'Arial' })).status, 400)
    assert.equal((await post(origin, { role: 'text', family: 42 })).status, 400)
    assert.equal((await post(origin, '{')).status, 400)
    assert.equal((await post(origin, { role: 'text', family: 'x'.repeat(300) })).status, 400)
    assert.equal((await post(origin, { role: 'text', family: 'Definitely Not A Font' })).status, 422)
    const wrongMethod = await fetch(`${origin}/dsh-font-picker/apply`)
    assert.equal(wrongMethod.status, 405)
  })
})

test('cross-origin writes are rejected while same-origin passes', async () => {
  const { settings } = createSettings()
  await withServer(boot(true, settings), async (origin) => {
    const cross = await post(origin, { role: 'text', family: 'Arial' }, { origin: 'http://evil.example' })
    assert.equal(cross.status, 403)
    const same = await post(origin, { role: 'nope', family: '' }, { origin })
    assert.equal(same.status, 400)
  })
})

test('degrades with 503 when the settings service is missing', async () => {
  await withServer(boot(false), async (origin) => {
    const applyResponse = await post(origin, { role: 'text', family: 'Arial' })
    assert.equal(applyResponse.status, 503)
    const stateResponse = await fetch(`${origin}/dsh-font-picker/state`)
    assert.equal(stateResponse.status, 503)
  })
})
