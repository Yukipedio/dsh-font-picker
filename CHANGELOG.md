# Changelog / 更新日志

本文件提供中英双语：中文在前、英文在后，版本从新到旧。
Bilingual changelog: Chinese first, English follows; newest version first.

## 2.4.2

### 中文

- Host 测试不再假设“非空字体列表一定伴随可读目录”，并把 Windows 字体注册表断言限定在 win32 平台；macOS 的 CI 失败由这些平台差异断言引起，现在测试只验证响应契约。
- 本地 27 项测试通过，Windows / macOS / Linux 三平台 CI 恢复全绿。

### English

- Host tests no longer assume that a non-empty font list always has a readable directory, and the Windows font-registry assertion is limited to win32; the macOS CI failure came from these platform-specific assumptions. Tests now verify the response contract only.
- All 27 local tests pass and CI is green on Windows, macOS and Linux.

## 2.4.1

### 中文

- 修复 `/dsh-font-picker/apply` 的处理顺序：现在先检查 settings 服务与 `ui-theme` 条目，再校验字体是否安装。没有原生字体设置的环境会正确返回 503，而不是因为字体不在本机而误报 422。
- CI 在 Windows / macOS / Linux 三平台恢复全绿（此前 macOS/Linux 的降级测试因处理顺序失败）。

### English

- Fixed the `/dsh-font-picker/apply` handler order: it now checks the settings service and the `ui-theme` entry before validating the font family. Profiles without native font settings correctly receive 503 instead of a misleading 422 for an unknown family.
- CI is green again on Windows, macOS and Linux (the degradation test previously failed on macOS/Linux because of the handler order).

## 2.4.0

### 中文

- **跨平台字体发现**：Windows、macOS、Linux 分别扫描各自字体目录；Linux 递归扫描字体子目录；Windows 字体注册表兜底仍仅在 Windows 生效。
- **测试可移植**：Host 测试不再依赖特定本机字体；新增开源包检查（npm 元数据、LICENSE、CI、三语 README、机器路径隐私扫描）；GitHub Actions 矩阵覆盖 Windows / macOS / Linux × Node 22/24。
- **开源发布工程**：移除 `private`，加入 MIT `LICENSE`、npm 元数据与 `publishConfig`、`.gitignore`，README 提供中文（主）、英文、日文三版。
- npm 包名 `dsh-font-picker` 可用；包元数据指向 `github.com/Yukipedio/dsh-font-picker`，并发布到官方 npm registry。

### English

- **Cross-platform font discovery**: Windows, macOS and Linux platform font directories; Linux font trees are scanned recursively; the Windows registry fallback stays Windows-only.
- **Portable tests**: Host tests no longer require a specific installed font; new open-source package checks (npm metadata, licence, CI, three-language READMEs, machine-path privacy sweep); the GitHub Actions matrix covers Windows, macOS and Linux on Node 22/24.
- **Open-source release engineering**: removed `private`, added the MIT `LICENSE`, npm metadata and `publishConfig`, `.gitignore`, and READMEs in Chinese (primary), English and Japanese.
- The npm package name `dsh-font-picker` is available; metadata points at `github.com/Yukipedio/dsh-font-picker` and publishes to the official npm registry.

## 2.3.0

### 中文

- 测试移入包内（`test/`，`node --test "test/*.test.mjs"`），覆盖 Host 路由、原生设置往返、校验、跨域防护、Client 注册/渲染、筛选、最近使用与静态检查。
- 插件详情页：`meta.detail` + `docs/DETAIL.md` / `docs/DETAIL.zh.md`，配无文字的 640×300 `preview.svg`。
- 清单加固：`engines.dsh`、`scripts.test`，`files` 增加 `docs`、`CHANGELOG.md`。
- README 补充维护流程与详情资源说明。

### English

- Tests moved into the package (`test/`, `node --test "test/*.test.mjs"`) covering the Host routes, native settings round trip, validation, origin guard, client registration/rendering, filters, recents and static checks.
- Plugin detail page: `meta.detail` + `docs/DETAIL.md` / `docs/DETAIL.zh.md` with a text-free 640×300 `preview.svg`.
- Manifest hardening: `engines.dsh`, `scripts.test`, files list includes `docs` and `CHANGELOG.md`.
- README documents the maintenance workflow and the detail resources.

## 2.2.1

### 中文

- 修复角色页签显示 `role.undefined`、点页签后再点字体报 `role must be one of text, code, terminal` 的回归（角色 id 改为字符串数组后仍按对象读取）。
- 可用性判断增加 Windows 字体注册表兜底：canvas 探测不到但注册表已安装的字体（如 `Arial Rounded MT Bold`）不再被误标「本机不可用」。

### English

- Fixed role tabs rendering `role.undefined` and the subsequent `role must be one of text, code, terminal` write failure (string role ids were still read as objects).
- Availability check now trusts the Windows font registry when the canvas probe cannot see a registered family (e.g. `Arial Rounded MT Bold` no longer marked unavailable).

## 2.2.0

### 中文

- P2：中英双语客户端字典与跟随语言的侧栏标签、键盘焦点环与 ARIA 状态、来源筛选（全部/系统/用户/自定义）、最近使用、加载骨架屏，以及 ≤767px 窄屏布局。

### English

- P2: zh/en client dictionaries with a locale-bound sidebar label, keyboard focus rings and ARIA state, source filters (all/system/user/custom), recent picks, skeleton loading and a ≤767px layout.

## 2.1.0

### 中文

- P1：基于 canvas 的可用性校验与本地化名回退、失效字体告警与一键恢复、写入时字族校验（422）、跨域写入拒绝（403）、`.ttc` 全部 face 解析、扫描诊断信息（`errors`、`scanned`、`faces`）。

### English

- P1: canvas-based availability verification with localized-name fallback, stale-font warning with one-click reset, apply-time family validation (422), cross-origin write rejection (403), full `.ttc` face parsing, scan diagnostics (`errors`, `scanned`, `faces`).

## 2.0.0

### 中文

- P0：原生设置架构。枚举本机已安装字体，并通过 Host `settings` 服务写入 `textFontFamily` / `codeFontFamily` / `terminalFontFamily`；移除 CSS `!important` 覆盖、localStorage 选择与字体文件服务。v1 选择在启动时一次性迁移。

### English

- P0: native-settings architecture. Lists installed fonts and writes `textFontFamily` / `codeFontFamily` / `terminalFontFamily` through the Host `settings` service; removed the CSS `!important` override, localStorage selection and font-file serving. v1 selections migrate once on startup.
