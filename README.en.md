# dsh-font-picker

[![npm version](https://img.shields.io/npm/v/dsh-font-picker.svg)](https://www.npmjs.com/package/dsh-font-picker) [![npm downloads](https://img.shields.io/npm/dm/dsh-font-picker.svg)](https://www.npmjs.com/package/dsh-font-picker)

English | [简体中文](README.md) | [日本語](README.ja.md)

A font picker for DeepSeek Harness (DSH): open it from the sidebar `Aa` icon, browse the fonts installed on this machine, and write the pick into DSH's **native font settings** (Settings → General → Fonts) for text, code and terminal independently. No CSS overrides, no font files served, no telemetry.

## Features

- **Installed font discovery**: parses the `name` table and OS/2 weight of TTF / OTF / TTC files; shows the real family name, localized name (e.g. `LXGW WenKai（霞鹜文楷）`), weights and source.
- **Writes native settings**: the same data as Settings → General → Fonts, shared across windows and sessions and persisted across restarts.
- **Availability checks**: canvas measurement with a Windows font-registry fallback, so invalid family names are not written; a stale selection is flagged with one-click reset.
- **Quality of life**: search, source filters (system / user / custom), recent picks, Chinese and English UI, keyboard and screen-reader support, narrow-screen layout.
- **Cross-platform**: scans Windows, macOS and Linux font directories; Windows additionally reads the font registry.

## Requirements

- DSH ≥ 0.2.2 (native font settings; `engines.dsh` is declared)
- Web profile (the desktop app ships the Web UI)
- Windows / macOS / Linux; CI runs the tests on all three platforms

## Installation

### Option 1: local directory (recommended)

1. Download the source archive from GitHub Releases, or `git clone` and unpack it;
2. In DSH open **Plugins → Add plugin** and select the plugin directory (the one containing `package.json`);
3. Refresh the page — the sidebar shows `Aa`.

### Option 2: npm

Package name `dsh-font-picker`. If your DSH plugin installer accepts npm install specs, install `dsh-font-picker@latest` directly; otherwise run `npm pack`, unpack the tarball and use Option 1.

## Usage

1. Click `Aa` in the sidebar.
2. Pick a role at the top (Text / UI, Code, Terminal) — it shows the current family for that role.
3. Search or filter by source, then click a row to write it; the change applies immediately. "Reset" clears the role's font.
4. The same settings are visible and editable in Settings → General → Fonts.

## Configuration

Edit `cordis.patch.yml` in the plugin package (reload DSH after changing it):

```yaml
- insert:
    - id: font-picker
      name: dsh-font-picker
      config:
        scanSystemFonts: true   # scan the platform font directories
        extraFontDirs: []       # extra absolute directories to scan
```

## Platform font directories

| Platform | Scanned directories |
| --- | --- |
| Windows | `%WINDIR%\Fonts`, `%LOCALAPPDATA%\Microsoft\Windows\Fonts` |
| macOS | `/System/Library/Fonts`, `/System/Library/Fonts/Supplemental`, `/Library/Fonts`, `~/Library/Fonts` |
| Linux | `~/.fonts`, `~/.local/share/fonts`, `/usr/local/share/fonts`, `/usr/share/fonts` (recursive) |

## Security and privacy

- Only three `/dsh-font-picker/*` endpoints on the local loopback HTTP server; no network access, no telemetry.
- Reading is limited to local font directories; writing only changes DSH's `textFontFamily` / `codeFontFamily` / `terminalFontFamily`.
- The write endpoint rejects cross-origin requests and only accepts family names that exist in the local font list.

## Development

```bash
npm test
# same as
node --test "test/*.test.mjs"
```

Layout: Host half `index.js` (font scanning / settings writes / routes), Client half `client.js` (sidebar entry and page); `test/` covers the HTTP contract, page rendering and package integrity; see [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Documentation

- [CHANGELOG](CHANGELOG.md)
- Plugin detail document: [docs/DETAIL.md](docs/DETAIL.md)

## License

[MIT](LICENSE)
