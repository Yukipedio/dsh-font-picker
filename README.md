# dsh-font-picker

[English](README.en.md) | 简体中文 | [日本語](README.ja.md)

DeepSeek Harness（DSH）的字体选择器：左侧栏 `Aa` → 列出本机已安装字体 → 一键写入 DSH 的**原生字体设置**（设置 → 通用 → 字体），正文 / 代码 / 终端三个角色独立。不覆盖 CSS、不注入字体文件、不收集任何数据。

## 特性

- **本机字体枚举**：解析 TTF / OTF / TTC 的 `name` 表与 OS/2 字重，显示真实字族名、本地化名（如 `LXGW WenKai（霞鹜文楷）`）、字重与来源。
- **直接写原生设置**：与「设置 → 通用 → 字体」是同一份数据，跨窗口、跨会话共享，重启保留。
- **可用性校验**：canvas 度量 + Windows 字体注册表兜底，避免写进无效字体名；当前字体失效时告警并可一键恢复默认。
- **好用的小功能**：搜索、来源筛选（系统 / 用户 / 自定义）、最近使用、中英界面、键盘与读屏无障碍、窄屏适配。
- **跨平台**：Windows / macOS / Linux 的字体目录均会扫描；Windows 额外读取字体注册表。

## 环境要求

- DSH ≥ 0.2.2（自带原生字体设置；包内已声明 `engines.dsh`）
- Web profile（桌面版内置 Web UI）
- Windows / macOS / Linux；CI 会在三平台运行测试

## 安装

### 方式一：本地目录（推荐）

1. 从 GitHub Release 下载源码包，或 `git clone` 后解压；
2. 打开 DSH → **Plugins → Add plugin**，选择插件目录（含 `package.json`）；
3. 刷新页面，左侧栏出现 `Aa`。

### 方式二：npm

包名 `dsh-font-picker`。若你的 DSH 插件安装器支持 npm 安装 spec，可直接安装 `dsh-font-picker@latest`；否则先 `npm pack`，解压 tarball 后按方式一安装本地目录。

## 使用

1. 点左侧栏 `Aa`；
2. 顶部选择角色（正文 / 界面、代码块、终端）——会显示该角色当前字体；
3. 搜索或按来源筛选字体，点一行即写入并立即生效；「恢复默认」清空该角色字体；
4. 同一份设置也可以在「设置 → 通用 → 字体」里查看或修改。

## 配置

编辑插件包内的 `cordis.patch.yml`（改完重载 DSH 生效）：

```yaml
- insert:
    - id: font-picker
      name: dsh-font-picker
      config:
        scanSystemFonts: true   # 扫描平台字体目录
        extraFontDirs: []       # 额外字体目录（绝对路径）
```

## 平台字体目录

| 平台 | 扫描目录 |
| --- | --- |
| Windows | `%WINDIR%\Fonts`、`%LOCALAPPDATA%\Microsoft\Windows\Fonts` |
| macOS | `/System/Library/Fonts`、`/System/Library/Fonts/Supplemental`、`/Library/Fonts`、`~/Library/Fonts` |
| Linux | `~/.fonts`、`~/.local/share/fonts`、`/usr/local/share/fonts`、`/usr/share/fonts`（递归子目录） |

## 安全与隐私

- 仅在本机回环 HTTP 暴露三个 `/dsh-font-picker/*` 接口；不联网、无遥测。
- 字体读取只读本机字体目录；写入只修改 DSH 的 `textFontFamily` / `codeFontFamily` / `terminalFontFamily`。
- 写入接口拒绝跨域请求；字体名必须存在于本机字体列表。

## 开发

```bash
npm test
# 等价于
node --test "test/*.test.mjs"
```

结构：Host 半 `index.js`（字体扫描 / 设置写入 / 路由），Client 半 `client.js`（侧栏入口与页面）；`test/` 覆盖接口契约、页面渲染与包完整性；CI 见 [.github/workflows/ci.yml](.github/workflows/ci.yml)。

## 文档

- [CHANGELOG](CHANGELOG.md)
- 插件详情文档：[docs/DETAIL.md](docs/DETAIL.md)

## 许可证

[MIT](LICENSE)
