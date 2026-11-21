/**
 * dsh-font-picker — Client half (v2.2, native-settings mode).
 *
 * Lists the fonts installed on this machine and writes the picked family into
 * the native DSH font settings (Settings → General → Fonts: text / code /
 * terminal). It never overrides CSS, so the native inputs and this page always
 * agree.
 *
 * v2.2 (P2): client locale dictionaries (zh/en), keyboard/focus accessibility,
 * source filters, recent picks, skeleton loading and a narrow-screen layout.
 */
window.__ModuleLoader__.load({
  id: 'dsh-font-picker',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const API = '/dsh-font-picker'
    const LOCALE_NS = 'dsh-font-picker'
    const OLD_STORAGE_KEY = 'dsh-font-picker.selection.v1'
    const RECENT_KEY = 'dsh-font-picker.recent.v1'
    const ROLES = ['text', 'code', 'terminal']
    const FALLBACK_BASES = ['monospace', 'serif', 'sans-serif']
    const SAMPLE_TEXT = 'mmmmmmmmmmlli 中文字体测试'

    /* ------------------------------------------------------------ locale */

    const DICT = {
      zh: {
        'title': '字体',
        'subtitle': '列出本机已安装字体，选中后写入「设置 → 通用 → 字体」的同一份设置；与原生字体输入框完全同步。',
        'role.group': '应用范围',
        'role.text': '正文 / 界面',
        'role.text.hint': '界面与会话正文',
        'role.code': '代码块',
        'role.code.hint': '代码块、行内代码',
        'role.terminal': '终端',
        'role.terminal.hint': '侧栏终端',
        'tab.default': '默认字体',
        'search.placeholder': '搜索字体名称…',
        'search.label': '搜索字体',
        'toolbar.count': '{shown} / {total} 款',
        'toolbar.refresh': '刷新列表',
        'toolbar.reset': '恢复默认',
        'filter.all': '全部',
        'filter.system': '系统',
        'filter.user': '用户',
        'filter.custom': '自定义',
        'filter.label': '字体来源',
        'recents.label': '最近使用',
        'count.reading': '正在读取…',
        'list.label': '已安装字体列表',
        'row.unavailable': '本机不可用',
        'row.current': '使用中',
        'warning.missing': '当前「{role}」设置的字体「{family}」在本机未找到或无法解析，页面会回退到默认字体。',
        'notice.applied': '已写入「{role}」：{family}',
        'notice.reset': '「{role}」已恢复默认字体',
        'notice.failed': '写入失败：{error}',
        'notice.refreshed': '字体列表已刷新',
        'notice.refreshFailed': '刷新失败：{error}',
        'error.load': '读取字体列表失败：{error}',
        'error.retry': '重试',
        'empty.noFonts': '没有找到已安装字体。',
        'empty.noMatch': '没有匹配「{query}」的字体。',
        'empty.noFilter': '当前来源筛选下没有字体。',
        'stats.base': '已扫描 {scanned} 个字体文件 · {count} 个字体族',
        'stats.errors': ' · {count} 个目录不可读',
        'note': '只列出本机已安装字体；修改会立即生效，并保存在 DSH 设置里（所有窗口共用）。代码/终端建议选择等宽字体。',
        'weight.light': 'Light',
        'weight.regular': 'Regular',
        'weight.medium': 'Medium',
        'weight.semibold': 'SemiBold',
        'weight.bold': 'Bold',
        'weight.black': 'Black',
        'source.system': '系统',
        'source.user': '用户',
        'source.custom': '自定义目录',
        'sidebar': '字体',
      },
      en: {
        'title': 'Fonts',
        'subtitle': 'Lists the fonts installed on this machine and writes the pick into Settings → General → Fonts; the native inputs stay in sync.',
        'role.group': 'Applies to',
        'role.text': 'Text / UI',
        'role.text.hint': 'Interface and conversation text',
        'role.code': 'Code',
        'role.code.hint': 'Code blocks and inline code',
        'role.terminal': 'Terminal',
        'role.terminal.hint': 'Sidebar terminal',
        'tab.default': 'Default font',
        'search.placeholder': 'Search font families…',
        'search.label': 'Search fonts',
        'toolbar.count': '{shown} / {total}',
        'toolbar.refresh': 'Refresh',
        'toolbar.reset': 'Reset',
        'filter.all': 'All',
        'filter.system': 'System',
        'filter.user': 'User',
        'filter.custom': 'Custom',
        'filter.label': 'Font source',
        'recents.label': 'Recent',
        'count.reading': 'Loading…',
        'list.label': 'Installed fonts',
        'row.unavailable': 'Unavailable',
        'row.current': 'In use',
        'warning.missing': 'The font “{family}” set for {role} cannot be found or resolved on this machine; the page falls back to the default font.',
        'notice.applied': 'Applied to {role}: {family}',
        'notice.reset': 'Reset the font for {role}',
        'notice.failed': 'Write failed: {error}',
        'notice.refreshed': 'Font list refreshed',
        'notice.refreshFailed': 'Refresh failed: {error}',
        'error.load': 'Failed to load the font list: {error}',
        'error.retry': 'Retry',
        'empty.noFonts': 'No installed fonts were found.',
        'empty.noMatch': 'No font matches “{query}”.',
        'empty.noFilter': 'No fonts under the current source filter.',
        'stats.base': 'Scanned {scanned} font files · {count} families',
        'stats.errors': ' · {count} unreadable folders',
        'note': 'Only installed fonts are listed. Changes apply immediately and live in DSH settings (shared by every window). Prefer a monospace font for code and terminal.',
        'weight.light': 'Light',
        'weight.regular': 'Regular',
        'weight.medium': 'Medium',
        'weight.semibold': 'SemiBold',
        'weight.bold': 'Bold',
        'weight.black': 'Black',
        'source.system': 'System',
        'source.user': 'User',
        'source.custom': 'Custom folder',
        'sidebar': 'Fonts',
      },
    }

    let translate = (key) => key
    const format = (template, vars) => String(template).replace(/\{(\w+)\}/gu, (match, name) => {
      const value = vars && vars[name]
      return value === undefined || value === null ? match : String(value)
    })
    const t = (key, vars) => format(translate(key), vars)

    /* ------------------------------------------------------------- state */

    let clientContext = null
    let current = { text: '', code: '', terminal: '' }
    const listeners = new Set()
    const emit = () => {
      for (const listener of Array.from(listeners)) {
        try {
          listener()
        } catch {}
      }
    }
    const subscribe = (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }

    const syncFromTheme = () => {
      try {
        const snapshot = clientContext === null ? null : clientContext.theme.getTheme()
        const families = snapshot && snapshot.fontFamilies ? snapshot.fontFamilies : {}
        current = {
          text: typeof families.text === 'string' ? families.text : '',
          code: typeof families.code === 'string' ? families.code : '',
          terminal: typeof families.terminal === 'string' ? families.terminal : '',
        }
      } catch {
        current = { text: '', code: '', terminal: '' }
      }
      emit()
    }

    /** First family of a normalized list, without quotes. */
    const firstFamily = (list) => {
      if (typeof list !== 'string') return ''
      const first = list.split(',')[0] || ''
      return first.replace(/^[\s"']+|[\s"']+$/gu, '').trim()
    }

    const roleLabel = (id) => t(`role.${id}`)

    /* ------------------------------------------------------- recent picks */

    const readRecents = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
        if (!Array.isArray(raw)) return []
        return raw.filter((item) => typeof item === 'string' && item !== '').slice(0, 6)
      } catch {
        return []
      }
    }
    const writeRecents = (list) => {
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(list))
      } catch {}
    }

    /* --------------------------------------------------- font availability */

    let measureContext
    const getMeasureContext = () => {
      if (measureContext !== undefined) return measureContext
      measureContext = null
      try {
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
          const canvas = document.createElement('canvas')
          const context = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null
          if (context && typeof context.measureText === 'function') measureContext = context
        }
      } catch {
        measureContext = null
      }
      return measureContext
    }

    const cssFamily = (name) => `"${String(name).replace(/["'\\]/gu, '')}"`

    /** Whether the browser resolves `family` (canvas metric differs from the base stack). */
    const familyResolves = (family) => {
      const context = getMeasureContext()
      if (context === null) return true
      const quoted = cssFamily(family)
      for (const base of FALLBACK_BASES) {
        try {
          context.font = `16px ${base}`
          const plain = context.measureText(SAMPLE_TEXT).width
          context.font = `16px ${quoted}, ${base}`
          const withFamily = context.measureText(SAMPLE_TEXT).width
          if (Math.abs(withFamily - plain) > 0.01) return true
        } catch {
          return true
        }
      }
      return false
    }

    /**
     * Resolve one list entry: prefer the English name, fall back to the
     * localized name, then trust the Windows font registration when canvas
     * measurement cannot see the family (some registered fonts are invisible to
     * the canvas probe but still usable through CSS).
     */
    const detectFont = (font) => {
      if (familyResolves(font.family)) return { available: true, use: font.family, fallback: false }
      if (typeof font.zh === 'string' && font.zh !== '' && familyResolves(font.zh)) {
        return { available: true, use: font.zh, fallback: true }
      }
      if (font.registered === true) return { available: true, use: font.family, fallback: false }
      return { available: false, use: font.family, fallback: false }
    }

    /** Write one role's family through the Host route (native settings). */
    const applyFamily = async (role, family) => {
      const response = await fetch(`${API}/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role, family }),
      })
      let data = {}
      try {
        data = await response.json()
      } catch {}
      if (!response.ok || data.ok !== true) throw new Error(data.error || `HTTP ${response.status}`)
      if (data.fontFamilies && typeof data.fontFamilies === 'object') {
        current = {
          text: typeof data.fontFamilies.text === 'string' ? data.fontFamilies.text : current.text,
          code: typeof data.fontFamilies.code === 'string' ? data.fontFamilies.code : current.code,
          terminal: typeof data.fontFamilies.terminal === 'string' ? data.fontFamilies.terminal : current.terminal,
        }
        emit()
      }
      return data
    }

    /** One-time migration from the v1 localStorage selection. */
    const migrateFromV1 = async () => {
      let raw = null
      try {
        raw = localStorage.getItem(OLD_STORAGE_KEY)
      } catch {
        return
      }
      if (raw === null) return
      let old
      try {
        old = JSON.parse(raw)
      } catch {
        try {
          localStorage.removeItem(OLD_STORAGE_KEY)
        } catch {}
        return
      }
      if (!old || !Array.isArray(old.roles)) {
        try {
          localStorage.removeItem(OLD_STORAGE_KEY)
        } catch {}
        return
      }
      let installed = []
      try {
        const response = await fetch(`${API}/fonts`, { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          installed = Array.isArray(data.families) ? data.families : []
        }
      } catch {}
      const match = installed.find((font) => Array.isArray(font.files) && font.files.includes(old.file))
      if (match === undefined) {
        try {
          localStorage.removeItem(OLD_STORAGE_KEY)
        } catch {}
        return
      }
      const target = detectFont(match).use
      let attempted = 0
      let failed = 0
      for (const oldRole of old.roles) {
        if (!ROLES.includes(oldRole)) continue
        if (firstFamily(current[oldRole]) !== '') continue
        attempted += 1
        try {
          await applyFamily(oldRole, target)
        } catch {
          failed += 1
        }
      }
      if (attempted === 0 || failed === 0) {
        try {
          localStorage.removeItem(OLD_STORAGE_KEY)
        } catch {}
      }
    }

    /* --------------------------------------------------------------- view */

    const CSS = `
.dfp-page{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.dfp-header{flex:none;padding:20px 24px 14px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.dfp-title{margin:0;font-size:16px;line-height:24px;font-weight:600}
.dfp-sub{margin:4px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dfp-body{flex:1;min-height:0;overflow:auto;padding:16px 24px 40px;display:flex;flex-direction:column;gap:12px;max-width:920px;box-sizing:border-box;width:100%}
.dfp-roletabs{display:flex;flex-wrap:wrap;gap:8px;flex:none}
.dfp-roletab{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:150px;flex:1 1 180px;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,16px);background:var(--dsw-alias-bg-layer-1);color:inherit;padding:10px 14px;cursor:pointer;font:inherit;text-align:left}
.dfp-roletab:hover{background:var(--dsw-alias-bg-layer-2)}
.dfp-roletab[aria-pressed=true]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
.dfp-roletabLabel{font-size:13px;line-height:20px;font-weight:500}
.dfp-roletabValue{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dfp-warning{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none;border:.5px solid var(--dsw-alias-state-error-primary);border-radius:var(--dsw-radius-lg,16px);padding:10px 14px;background:var(--dsw-alias-bg-layer-1);font-size:12px;line-height:18px}
.dfp-warningText{color:var(--dsw-alias-state-error-primary);min-width:0}
.dfp-toolbar{display:flex;align-items:center;gap:8px;flex:none;flex-wrap:wrap}
.dfp-search{flex:1 1 220px;min-width:0;box-sizing:border-box;height:32px;padding:0 10px;font:inherit;font-size:13px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);outline:none}
.dfp-toolbarInfo{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.dfp-btn{flex:none;font:inherit;font-size:13px;line-height:20px;padding:5px 12px;border-radius:var(--dsw-radius-sm,8px);border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer}
.dfp-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.dfp-btn:disabled{opacity:.5;cursor:default}
.dfp-filters{display:flex;flex-wrap:wrap;align-items:center;gap:6px;flex:none}
.dfp-filterLabel{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);margin-right:2px}
.dfp-filter{font:inherit;font-size:12px;line-height:18px;padding:3px 10px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer}
.dfp-filter[aria-pressed=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.dfp-recents{display:flex;flex-wrap:wrap;align-items:center;gap:6px;flex:none}
.dfp-recent{font:inherit;font-size:12px;line-height:18px;padding:3px 10px;border-radius:999px;border:.5px dashed var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer}
.dfp-recent:hover{background:var(--dsw-alias-bg-layer-2)}
.dfp-list{display:flex;flex-direction:column;gap:2px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,16px);background:var(--dsw-alias-bg-layer-1);padding:6px}
.dfp-row{display:flex;align-items:center;gap:12px;padding:8px 12px;border:0;border-radius:var(--dsw-radius-md,12px);background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit;width:100%;box-sizing:border-box}
.dfp-row:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.dfp-row:disabled{cursor:default;opacity:.55}
.dfp-row[data-current=true]{background:var(--dsw-alias-bg-layer-2);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}
.dfp-preview{flex:none;width:104px;font-size:18px;line-height:26px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary)}
.dfp-rowText{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.dfp-rowName{font-size:14px;line-height:20px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dfp-rowMeta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dfp-check{flex:none;font-size:11px;color:var(--dsw-alias-brand-primary)}
.dfp-checkOff{flex:none;font-size:11px;color:var(--dsw-alias-state-error-primary)}
.dfp-empty{padding:16px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dfp-notice{flex:none;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);min-height:18px}
.dfp-notice[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
.dfp-note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dfp-loadingText{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dfp-skeletons{display:flex;flex-direction:column;gap:6px;padding-top:8px}
.dfp-skeleton{height:38px;border-radius:var(--dsw-radius-md,12px);background:linear-gradient(90deg,var(--dsw-alias-bg-layer-2),var(--dsw-alias-bg-layer-1),var(--dsw-alias-bg-layer-2));background-size:200% 100%;animation:dfp-shimmer 1.4s ease-in-out infinite}
@keyframes dfp-shimmer{0%{background-position:0% 0}100%{background-position:200% 0}}
@media (prefers-reduced-motion: reduce){.dfp-skeleton{animation:none}}
.dfp-page :focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
@media (max-width: 767px){
  .dfp-header{padding:14px 14px 10px}
  .dfp-body{padding:12px 14px 32px;gap:10px}
  .dfp-roletab{flex:1 1 100%;min-width:0;padding:8px 12px}
  .dfp-search{flex-basis:100%}
  .dfp-preview{width:64px;font-size:16px;line-height:24px}
  .dfp-warning{flex-direction:column;align-items:stretch}
  .dfp-filters{gap:4px}
}
`

    const WEIGHT_KEYS = {
      300: 'weight.light',
      400: 'weight.regular',
      500: 'weight.medium',
      600: 'weight.semibold',
      700: 'weight.bold',
      900: 'weight.black',
    }

    const describeSource = (sources) => {
      if (!Array.isArray(sources) || sources.length === 0) return ''
      return Array.from(new Set(sources.map((source) => t(`source.${source}`)))).join(' / ')
    }

    const describeMeta = (font) => {
      const parts = []
      if (font.zh) parts.push(font.zh)
      if (Array.isArray(font.weights) && font.weights.length > 0) {
        parts.push(font.weights.map((weight) => (WEIGHT_KEYS[weight] ? t(WEIGHT_KEYS[weight]) : String(weight))).join(' / '))
      }
      const source = describeSource(font.sources)
      if (source) parts.push(source)
      return parts.join(' · ')
    }

    const FILTERS = ['all', 'system', 'user', 'custom']

    function FontPage() {
      const [snapshot, setSnapshot] = React.useState({ ...current })
      const [payload, setPayload] = React.useState(null)
      const [error, setError] = React.useState('')
      const [role, setRole] = React.useState('text')
      const [search, setSearch] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState(null)
      const [availability, setAvailability] = React.useState({})
      const [filter, setFilter] = React.useState('all')
      const [recents, setRecents] = React.useState(readRecents)

      React.useEffect(() => subscribe(() => setSnapshot({ ...current })), [])

      const load = (force) => {
        setError('')
        fetch(`${API}/fonts${force ? '?refresh=1' : ''}`, { cache: 'no-store' })
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return response.json()
          })
          .then((data) => setPayload(data))
          .catch((cause) => setError(String(cause && cause.message ? cause.message : cause)))
      }

      React.useEffect(() => {
        load(false)
      }, [])

      React.useEffect(() => {
        if (payload === null) return
        const map = {}
        for (const font of payload.families || []) map[font.family] = detectFont(font)
        setAvailability(map)
      }, [payload])

      const pick = (font) => {
        const detection = availability[font.family]
        const target = detection !== undefined && detection.use ? detection.use : font.family
        setBusy(true)
        setNotice(null)
        applyFamily(role, target)
          .then(() => {
            setNotice({ text: t('notice.applied', { role: roleLabel(role), family: target }), tone: 'ok' })
            const next = [font.family, ...recents.filter((item) => item !== font.family)].slice(0, 6)
            setRecents(next)
            writeRecents(next)
          })
          .catch((cause) => setNotice({ text: t('notice.failed', { error: cause && cause.message ? cause.message : cause }), tone: 'error' }))
          .finally(() => setBusy(false))
      }

      const reset = () => {
        setBusy(true)
        setNotice(null)
        applyFamily(role, '')
          .then(() => setNotice({ text: t('notice.reset', { role: roleLabel(role) }), tone: 'ok' }))
          .catch((cause) => setNotice({ text: t('notice.failed', { error: cause && cause.message ? cause.message : cause }), tone: 'error' }))
          .finally(() => setBusy(false))
      }

      const query = search.trim().toLowerCase()
      const allFonts = payload && Array.isArray(payload.families) ? payload.families : []
      const filtered = allFonts.filter((font) => {
        if (filter !== 'all' && !(Array.isArray(font.sources) && font.sources.includes(filter))) return false
        if (query === '') return true
        const family = typeof font.family === 'string' ? font.family.toLowerCase() : ''
        const zh = typeof font.zh === 'string' ? font.zh.toLowerCase() : ''
        return family.includes(query) || zh.includes(query)
      })
      const activeFamily = firstFamily(snapshot[role])
      const activeFont = activeFamily === ''
        ? undefined
        : allFonts.find((font) => font.family === activeFamily || font.zh === activeFamily)
      const activeDetection = activeFont === undefined ? undefined : availability[activeFont.family]
      const activeMissing = payload !== null && activeFamily !== '' && (activeFont === undefined || (activeDetection !== undefined && activeDetection.available === false))

      const tabs = ROLES.map((id) => {
        const value = firstFamily(current[id])
        return h('button', {
          key: id,
          type: 'button',
          className: 'dfp-roletab',
          'aria-pressed': String(role === id),
          title: t(`role.${id}.hint`),
          onClick: () => {
            setRole(id)
            setNotice(null)
          },
        },
        h('span', { className: 'dfp-roletabLabel' }, t(`role.${id}`)),
        h('span', { className: 'dfp-roletabValue' }, value === '' ? t('tab.default') : value),
        )
      })

      const filterChips = FILTERS.map((id) => h('button', {
        key: id,
        type: 'button',
        className: 'dfp-filter',
        'aria-pressed': String(filter === id),
        onClick: () => setFilter(id),
      }, t(`filter.${id}`)))

      const recentFonts = query === '' && recents.length > 0
        ? recents.map((name) => allFonts.find((font) => font.family === name)).filter(Boolean)
        : []
      const recentChips = recentFonts.map((font) => h('button', {
        key: `recent-${font.family}`,
        type: 'button',
        className: 'dfp-recent',
        title: t('recents.label'),
        onClick: () => pick(font),
      }, font.family))

      const rows = filtered.map((font) => {
        const detection = availability[font.family]
        const unavailable = detection !== undefined && detection.available === false
        const isCurrent = activeFamily !== '' && (activeFamily === font.family || activeFamily === font.zh)
        return h('button', {
          key: font.family,
          type: 'button',
          className: 'dfp-row',
          'data-current': String(isCurrent),
          'aria-current': isCurrent ? 'true' : undefined,
          disabled: busy || unavailable,
          title: unavailable ? `${font.family} · ${t('row.unavailable')}` : `${font.family}${font.zh ? `（${font.zh}）` : ''}`,
          onClick: () => pick(font),
        },
        h('span', {
          className: 'dfp-preview',
          style: { fontFamily: `${cssFamily(detection && detection.use ? detection.use : font.family)}, sans-serif` },
          'aria-hidden': 'true',
        }, 'Aa 中文 123'),
        h('span', { className: 'dfp-rowText' },
          h('span', { className: 'dfp-rowName' }, font.zh ? `${font.family}（${font.zh}）` : font.family),
          h('span', { className: 'dfp-rowMeta' }, describeMeta(font)),
        ),
        unavailable
          ? h('span', { className: 'dfp-checkOff' }, t('row.unavailable'))
          : isCurrent ? h('span', { className: 'dfp-check' }, t('row.current')) : null,
        )
      })

      const stats = payload === null
        ? ''
        : t('stats.base', { scanned: payload.scanned, count: payload.count })
          + (Array.isArray(payload.errors) && payload.errors.length > 0 ? t('stats.errors', { count: payload.errors.length }) : '')

      return h('div', { className: 'dfp-page' },
        h('style', null, CSS),
        h('header', { className: 'dfp-header' },
          h('h1', { className: 'dfp-title' }, t('title')),
          h('p', { className: 'dfp-sub' }, t('subtitle')),
        ),
        h('div', { className: 'dfp-body' },
          h('div', { className: 'dfp-roletabs', role: 'group', 'aria-label': t('role.group') }, tabs),
          activeMissing ? h('div', { className: 'dfp-warning', role: 'alert' },
            h('span', { className: 'dfp-warningText' }, t('warning.missing', { role: roleLabel(role), family: activeFamily })),
            h('button', { type: 'button', className: 'dfp-btn', disabled: busy, onClick: reset }, t('toolbar.reset')),
          ) : null,
          h('div', { className: 'dfp-toolbar' },
            h('input', {
              className: 'dfp-search',
              type: 'search',
              placeholder: t('search.placeholder'),
              value: search,
              'aria-label': t('search.label'),
              onChange: (event) => setSearch(event.currentTarget.value),
            }),
            h('span', { className: 'dfp-toolbarInfo' }, payload === null ? t('count.reading') : t('toolbar.count', { shown: filtered.length, total: allFonts.length })),
            h('button', {
              type: 'button',
              className: 'dfp-btn',
              disabled: busy,
              onClick: () => {
                setBusy(true)
                setNotice(null)
                fetch(`${API}/fonts?refresh=1`, { cache: 'no-store' })
                  .then((response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`)
                    return response.json()
                  })
                  .then((data) => {
                    setPayload(data)
                    setNotice({ text: t('notice.refreshed'), tone: 'ok' })
                  })
                  .catch((cause) => setNotice({ text: t('notice.refreshFailed', { error: cause && cause.message ? cause.message : cause }), tone: 'error' }))
                  .finally(() => setBusy(false))
              },
            }, t('toolbar.refresh')),
            h('button', {
              type: 'button',
              className: 'dfp-btn',
              disabled: busy,
              onClick: reset,
            }, t('toolbar.reset')),
          ),
          h('div', { className: 'dfp-filters', role: 'group', 'aria-label': t('filter.label') },
            h('span', { className: 'dfp-filterLabel' }, t('filter.label')),
            filterChips,
          ),
          recentChips.length > 0 ? h('div', { className: 'dfp-recents', role: 'group', 'aria-label': t('recents.label') },
            h('span', { className: 'dfp-filterLabel' }, t('recents.label')),
            recentChips,
          ) : null,
          h('div', { className: 'dfp-notice', 'data-tone': notice !== null && notice.tone === 'error' ? 'error' : 'info', role: 'status', 'aria-live': 'polite' }, notice === null ? '' : notice.text),
          error !== ''
            ? h('div', { className: 'dfp-list' }, h('div', { className: 'dfp-empty' },
              t('error.load', { error }),
              h('button', { type: 'button', className: 'dfp-btn', onClick: () => load(false) }, t('error.retry')),
            ))
            : null,
          payload === null && error === ''
            ? h('div', { className: 'dfp-list' },
              h('div', { className: 'dfp-loadingText' }, t('count.reading')),
              h('div', { className: 'dfp-skeletons', 'aria-hidden': 'true' },
                Array.from({ length: 6 }, (_, index) => h('div', { key: index, className: 'dfp-skeleton' })),
              ),
            )
            : null,
          payload !== null && error === ''
            ? h('div', { className: 'dfp-list', 'aria-label': t('list.label'), 'aria-busy': String(busy) },
              filtered.length === 0
                ? h('div', { className: 'dfp-empty' }, query === ''
                  ? (filter === 'all' ? t('empty.noFonts') : t('empty.noFilter'))
                  : t('empty.noMatch', { query: search }))
                : rows,
            )
            : null,
          h('p', { className: 'dfp-note' }, t('note') + (stats === '' ? '' : ` ${stats}`)),
        ),
      )
    }

    function FontIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 20
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': 'true',
      },
      h('text', {
        x: 12,
        y: 16.5,
        textAnchor: 'middle',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 13,
        fontWeight: 700,
        fill: 'currentColor',
        stroke: 'none',
      }, 'Aa'))
    }

    return {
      inject: ['slots', 'theme', 'locale'],
      apply(ctx) {
        clientContext = ctx
        syncFromTheme()
        ctx.effect(() => ctx.locale.register(LOCALE_NS, DICT))
        translate = ctx.locale.bind(LOCALE_NS)
        ctx.effect(() => ctx.locale.subscribe(() => {
          translate = ctx.locale.bind(LOCALE_NS)
          emit()
        }))
        ctx.on('theme/change', () => syncFromTheme())
        migrateFromV1().catch(() => {})
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'dsh-font-picker',
          order: 40,
          label: () => t('sidebar'),
        }, FontIcon))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'dsh-font-picker',
        }, FontPage))
      },
    }
  },
})
