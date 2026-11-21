# Changelog

## 2.4.0

- Cross-platform font discovery: platform font directories on Windows, macOS and Linux (Linux font trees are scanned recursively); the Windows registry fallback stays Windows-only.
- Portable tests: Host tests no longer require a specific installed font; new open-source package checks (metadata, licence, CI, three-language READMEs, machine-path privacy sweep); GitHub Actions matrix covers Windows, macOS and Linux on Node 22/24.
- Open-source release engineering: removed `private`, added the MIT `LICENSE`, npm metadata and `publishConfig`, `.gitignore`, and READMEs in Chinese (primary), English and Japanese.
- The npm package name `dsh-font-picker` is available; package metadata points at `github.com/Yukipedio/dsh-font-picker` and publishes to the official npm registry.

## 2.3.0

- Tests moved into the package (`test/`, `node --test test/`) covering the Host routes, native settings round trip, validation, origin guard, client registration/rendering, filters, recents and static P2 checks.
- Plugin detail page: `meta.detail` + `docs/DETAIL.md` / `docs/DETAIL.zh.md` with a text-free 640×300 `preview.svg`.
- Manifest hardening: `engines.dsh`, `scripts.test`, files list includes `docs` and `CHANGELOG.md`.
- README documents the maintenance workflow and the detail resources.

## 2.2.1

- Fixed role tabs rendering `role.undefined` and the subsequent `role must be one of text, code, terminal` write failure (string role ids were still read as objects).
- Availability check now trusts the Windows font registry when the canvas probe cannot see a registered family (e.g. `Arial Rounded MT Bold` no longer marked unavailable).

## 2.2.0

- P2: zh/en client dictionaries with a locale-bound sidebar label, keyboard focus rings and ARIA state, source filters (all/system/user/custom), recent picks, skeleton loading and a ≤767px layout.

## 2.1.0

- P1: canvas-based availability verification with localized-name fallback, stale-font warning with one-click reset, apply-time family validation (422), cross-origin write rejection (403), full `.ttc` face parsing, scan diagnostics (`errors`, `scanned`, `faces`).

## 2.0.0

- P0: native-settings architecture. Lists installed fonts and writes `textFontFamily` / `codeFontFamily` / `terminalFontFamily` through the Host `settings` service; removed the CSS `!important` override, localStorage selection and font-file serving. v1 selections migrate once on startup.
