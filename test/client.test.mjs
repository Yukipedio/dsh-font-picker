// Client tests for dsh-font-picker: module registration, page rendering,
// filters, recents, accessibility attributes and static P2 checks.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CLIENT_PATH = new URL('../client.js', import.meta.url)
const CLIENT_TEXT = readFileSync(CLIENT_PATH, 'utf8')

let definition
globalThis.window = {
  __ModuleLoader__: {
    load(value) {
      definition = value
    },
  },
}
const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
}

await import(CLIENT_PATH.href)

const LOCALE_MAP = {
  sidebar: '字体',
  title: '字体',
  'count.reading': '正在读取…',
  'role.group': '应用范围',
  'role.text': '正文 / 界面',
  'role.code': '代码块',
  'role.terminal': '终端',
  'tab.default': '默认字体',
  'search.label': '搜索字体',
  'list.label': '已安装字体',
  'filter.label': '字体来源',
  'filter.all': '全部',
  'filter.system': '系统',
  'filter.user': '用户',
  'filter.custom': '自定义',
  'recents.label': '最近使用',
  'row.current': '使用中',
  'row.unavailable': '本机不可用',
  'toolbar.refresh': '刷新列表',
  'toolbar.reset': '恢复默认',
}

const PAYLOAD = {
  count: 2,
  scanned: 2,
  faces: 2,
  skipped: 0,
  registered: 2,
  errors: [],
  dirs: ['/usr/share/fonts', '/System/Library/Fonts'],
  families: [
    { family: 'LXGW WenKai', zh: '霞鹜文楷', weights: [400], styles: ['Regular'], sources: ['user'], files: ['LXGWWenKai-Regular.ttf'], registered: true },
    { family: 'Arial', zh: '', weights: [400, 700], styles: ['Regular', 'Bold'], sources: ['system'], files: ['arial.ttf', 'arialbd.ttf'], registered: true },
  ],
}

function fakeReact(hookValues) {
  let hook = 0
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }),
    useState: (initial) => {
      const index = hook++
      return [index in hookValues ? hookValues[index] : initial, () => {}]
    },
    useEffect: () => {
      hook++
    },
  }
  return React
}

function boot(hookValues, themeFamilies) {
  const calls = { register: 0, subscribe: 0, getTheme: 0 }
  const registrations = []
  const injections = []
  const context = {
    theme: {
      getTheme() {
        calls.getTheme += 1
        return { fontFamilies: themeFamilies }
      },
    },
    locale: {
      register() {
        calls.register += 1
      },
      bind() {
        return (key) => (Object.prototype.hasOwnProperty.call(LOCALE_MAP, key) ? LOCALE_MAP[key] : key)
      },
      subscribe() {
        calls.subscribe += 1
        return () => {}
      },
    },
    on() {},
    effect(fn) {
      fn()
    },
    slots: {
      inject(slot, callback) {
        injections.push(slot)
        callback()
      },
      register(options, component) {
        registrations.push({ options, component })
      },
    },
  }
  const plugin = definition.factory((name) => {
    if (name === 'react') return fakeReact(hookValues)
    throw new Error(`unexpected require: ${name}`)
  })
  plugin.apply(context)
  return { plugin, calls, registrations, injections }
}

function renderPage(hookValues, themeFamilies) {
  const { registrations } = boot(hookValues, themeFamilies)
  const page = registrations.find((entry) => entry.options.name === 'main')
  assert.ok(page, 'main registration must exist')
  const tree = page.component({})
  const elements = []
  const texts = []
  const walk = (node) => {
    if (node === null || node === undefined || node === false) return
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    if (typeof node === 'string' || typeof node === 'number') {
      texts.push(String(node))
      return
    }
    elements.push(node)
    for (const child of node.children || []) walk(child)
  }
  walk(tree)
  return { elements, texts }
}

const byClass = (elements, className) => elements.filter((item) => item.props && item.props.className === className)

test('registers the sidebar entry and main page through the right services', () => {
  const { plugin, calls, registrations, injections } = boot(
    [{ text: '', code: '', terminal: '' }, null, '', 'text', '', false, null, {}, 'all', []],
    { text: '', code: '', terminal: '' },
  )
  assert.deepEqual([...plugin.inject].sort(), ['locale', 'slots', 'theme'])
  assert.deepEqual(injections, ['sidebar.panellist', 'main'])
  assert.equal(calls.register, 1)
  assert.equal(calls.subscribe, 1)
  assert.equal(calls.getTheme, 1)
  assert.equal(registrations.length, 2)
  assert.equal(registrations[0].options.id, 'dsh-font-picker')
  assert.equal(registrations[0].options.order, 40)
  assert.equal(registrations[0].options.label(), '字体')
  assert.equal(registrations[1].options.key, 'dsh-font-picker')
})

test('loading state renders skeleton rows and readable role labels', () => {
  const { elements, texts } = renderPage(
    [{ text: '', code: '', terminal: '' }, null, '', 'text', '', false, null, {}, 'all', []],
    { text: '', code: '', terminal: '' },
  )
  assert.equal(byClass(elements, 'dfp-skeleton').length, 6)
  assert.ok(texts.some((text) => text.includes('正在读取')))
  const tabs = byClass(elements, 'dfp-roletab')
  assert.equal(tabs.length, 3)
  const labels = tabs.flatMap((tab) => (tab.children || []).filter((child) => child.props && child.props.className === 'dfp-roletabLabel').map((child) => child.children[0]))
  assert.deepEqual(labels, ['正文 / 界面', '代码块', '终端'])
  assert.ok(!labels.some((label) => String(label).includes('undefined')))
})

test('loaded state renders fonts, current marker and accessibility attributes', () => {
  const { elements, texts } = renderPage(
    [{ text: '"LXGW WenKai"', code: '', terminal: '' }, PAYLOAD, '', 'text', '', false, null, {}, 'all', []],
    { text: '"LXGW WenKai"', code: '', terminal: '' },
  )
  const rows = byClass(elements, 'dfp-row')
  assert.equal(rows.length, 2)
  assert.equal(rows.filter((row) => row.props['data-current'] === 'true').length, 1)
  assert.ok(texts.some((text) => text.includes('霞鹜文楷')))

  const tabsGroup = elements.find((item) => item.props && item.props.className === 'dfp-roletabs')
  assert.equal(tabsGroup.props.role, 'group')
  assert.equal(tabsGroup.props['aria-label'], '应用范围')

  const search = elements.find((item) => item.props && item.props.className === 'dfp-search')
  assert.equal(search.props['aria-label'], '搜索字体')

  const list = elements.find((item) => item.props && item.props.className === 'dfp-list' && item.props['aria-label'] === '已安装字体')
  assert.ok(list, 'list must carry an aria-label')

  const notice = elements.find((item) => item.props && item.props.className === 'dfp-notice')
  assert.equal(notice.props['aria-live'], 'polite')
  assert.equal(notice.props.role, 'status')
})

test('search filters by localized family name', () => {
  const { elements } = renderPage(
    [{ text: '', code: '', terminal: '' }, PAYLOAD, '', 'text', '霞鹜', false, null, {}, 'all', []],
    { text: '', code: '', terminal: '' },
  )
  assert.equal(byClass(elements, 'dfp-row').length, 1)
})

test('source filter narrows the list', () => {
  const system = renderPage(
    [{ text: '', code: '', terminal: '' }, PAYLOAD, '', 'text', '', false, null, {}, 'system', []],
    { text: '', code: '', terminal: '' },
  )
  assert.equal(byClass(system.elements, 'dfp-row').length, 1)
  assert.ok(system.texts.some((text) => text.includes('Arial')))

  const user = renderPage(
    [{ text: '', code: '', terminal: '' }, PAYLOAD, '', 'text', '', false, null, {}, 'user', []],
    { text: '', code: '', terminal: '' },
  )
  assert.equal(byClass(user.elements, 'dfp-row').length, 1)
  assert.ok(user.texts.some((text) => text.includes('LXGW WenKai')))
})

test('recent picks render as shortcut chips', () => {
  const { elements, texts } = renderPage(
    [{ text: '', code: '', terminal: '' }, PAYLOAD, '', 'text', '', false, null, {}, 'all', ['Arial']],
    { text: '', code: '', terminal: '' },
  )
  assert.equal(byClass(elements, 'dfp-recent').length, 1)
  assert.ok(texts.includes('最近使用'))
})

test('static P2 checks: i18n completeness, focus styles, responsive rules, no CSS override', () => {
  const text = CLIENT_TEXT
  assert.ok(!text.includes('!important'), 'plugin must not inject CSS overrides')
  assert.ok(text.includes(':focus-visible'), 'focus style missing')
  assert.ok(text.includes('@media (max-width: 767px)'), 'responsive rule missing')
  assert.ok(text.includes('prefers-reduced-motion'), 'reduced motion rule missing')
  assert.ok(text.includes('aria-current'), 'aria-current missing')

  const start = text.indexOf('const DICT = {')
  const zhStart = text.indexOf('zh: {', start)
  const enStart = text.indexOf('en: {', zhStart)
  const end = text.indexOf('\n    }', enStart)
  const blockKeys = (block) => {
    const keys = new Set()
    for (const match of block.matchAll(/^\s*'([^']+)':/gmu)) keys.add(match[1])
    return keys
  }
  const zhKeys = blockKeys(text.slice(zhStart, enStart))
  const enKeys = blockKeys(text.slice(enStart, end))
  assert.ok(zhKeys.size >= 40, `expected a real zh dictionary, got ${zhKeys.size}`)
  assert.deepEqual([...zhKeys].sort(), [...enKeys].sort(), 'zh and en dictionaries must agree')

  const used = new Set()
  for (const match of text.matchAll(/\bt\('([^']+)'/gu)) used.add(match[1])
  for (const match of text.matchAll(/t\(`([^`]+)`/gu)) {
    const template = match[1]
    const values = template.startsWith('role.')
      ? ['text', 'code', 'terminal']
      : template.startsWith('filter.')
        ? ['all', 'system', 'user', 'custom']
        : ['system', 'user', 'custom']
    for (const value of values) {
      used.add(template.replace('${id}', value).replace('${source}', value))
    }
  }
  for (const role of ['text', 'code', 'terminal']) {
    used.add(`role.${role}`)
    used.add(`role.${role}.hint`)
  }
  for (const filter of ['all', 'system', 'user', 'custom']) used.add(`filter.${filter}`)
  for (const source of ['system', 'user', 'custom']) used.add(`source.${source}`)
  for (const weight of ['light', 'regular', 'medium', 'semibold', 'bold', 'black']) used.add(`weight.${weight}`)
  const missing = [...used].filter((key) => !zhKeys.has(key))
  assert.deepEqual(missing, [], `missing translations: ${missing.join(', ')}`)
})
