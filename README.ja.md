# dsh-font-picker

[English](README.en.md) | [简体中文](README.md) | 日本語

DeepSeek Harness（DSH）用のフォントピッカーです。サイドバーの `Aa` を開くと、このマシンにインストールされているフォントの一覧が表示され、選んだフォントを DSH の**標準フォント設定**（設定 → 一般 → フォント）へ書き込みます。本文・コード・ターミナルの 3 つの役割を個別に設定できます。CSS の上書き、フォントファイルの配信、テレメトリーは行いません。

## 機能

- **インストール済みフォントの列挙**：TTF / OTF / TTC の `name` テーブルと OS/2 のウェイトを解析し、実際のファミリー名、ローカライズ名（例：`LXGW WenKai（霞鹜文楷）`）、ウェイト、取得元を表示します。
- **標準設定へ直接書き込み**：設定 → 一般 → フォントと同じデータを共有し、ウィンドウやセッションをまたいで保持されます。
- **利用可否チェック**：canvas の計測と Windows フォントレジストリのフォールバックで、無効なフォント名を書き込みません。現在の設定が無効な場合は警告と「既定に戻す」を表示します。
- **便利な機能**：検索、取得元フィルター（システム / ユーザー / カスタム）、最近使ったフォント、中国語・英語 UI、キーボードとスクリーンリーダー対応、狭い画面向けレイアウト。
- **クロスプラットフォーム**：Windows / macOS / Linux のフォントディレクトリを走査します（Windows はレジストリも参照）。

## 要件

- DSH ≥ 0.2.2（標準フォント設定が必要。`engines.dsh` で宣言済み）
- Web プロファイル（デスクトップ版は Web UI を内蔵）
- Windows / macOS / Linux（CI で 3 プラットフォームのテストを実行）

## インストール

### 方法 1：ローカルディレクトリ（推奨）

1. GitHub Releases からソースアーカイブをダウンロードするか、`git clone` して展開します；
2. DSH で **Plugins → Add plugin** を開き、`package.json` を含むプラグインディレクトリを選択します；
3. ページを再読み込みすると、サイドバーに `Aa` が表示されます。

### 方法 2：npm

パッケージ名は `dsh-font-picker` です。DSH のプラグインインストーラーが npm のインストール spec に対応していれば `dsh-font-picker@2.4.0` を直接インストールできます。対応していない場合は `npm pack` で tarball を作成し、展開して方法 1 でインストールしてください。

## 使い方

1. サイドバーの `Aa` をクリックします。
2. 上部で役割（本文 / UI、コード、ターミナル）を選ぶと、その役割の現在のフォントが表示されます。
3. 検索や取得元フィルターで絞り込み、行をクリックすると即座に反映されます。「既定に戻す」でその役割の設定を消去します。
4. 同じ設定は「設定 → 一般 → フォント」からも確認・変更できます。

## 設定

プラグインパッケージ内の `cordis.patch.yml` を編集します（変更後は DSH を再読み込み）：

```yaml
- insert:
    - id: font-picker
      name: dsh-font-picker
      config:
        scanSystemFonts: true   # プラットフォームのフォントディレクトリを走査
        extraFontDirs: []       # 追加で走査する絶対パス
```

## プラットフォーム別フォントディレクトリ

| プラットフォーム | 走査するディレクトリ |
| --- | --- |
| Windows | `%WINDIR%\Fonts`、`%LOCALAPPDATA%\Microsoft\Windows\Fonts` |
| macOS | `/System/Library/Fonts`、`/System/Library/Fonts/Supplemental`、`/Library/Fonts`、`~/Library/Fonts` |
| Linux | `~/.fonts`、`~/.local/share/fonts`、`/usr/local/share/fonts`、`/usr/share/fonts`（サブディレクトリも再帰的に走査） |

## セキュリティとプライバシー

- ローカルループバックの HTTP に `/dsh-font-picker/*` の 3 つのエンドポイントのみを公開します。外部通信やテレメトリーはありません。
- 読み取りはローカルのフォントディレクトリのみ、書き込みは DSH の `textFontFamily` / `codeFontFamily` / `terminalFontFamily` のみです。
- 書き込みエンドポイントはクロスオリジンのリクエストを拒否し、ローカルのフォント一覧に存在するファミリー名だけを受け付けます。

## 開発

```bash
npm test
# 同等
node --test "test/*.test.mjs"
```

構成：Host 側 `index.js`（フォント走査 / 設定書き込み / ルート）、Client 側 `client.js`（サイドバーとページ）。`test/` は HTTP 契約、ページ描画、パッケージ整合性を検証します。CI は [.github/workflows/ci.yml](.github/workflows/ci.yml) を参照。

## ドキュメント

- [CHANGELOG](CHANGELOG.md)
- プラグイン詳細：[docs/DETAIL.md](docs/DETAIL.md)

## ライセンス

[MIT](LICENSE)
