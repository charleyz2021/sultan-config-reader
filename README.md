# 苏丹的游戏配置阅读器

这是一个纯前端的配置阅读器，用来查看《苏丹的游戏》`config` 目录里的 JSON/JSONC 配置。

它的设计目标是：

- 不内置游戏配置数据
- 用户自己导入本地游戏配置后，在浏览器里完成解析和阅读

## 当前功能

- 支持导入游戏的 `config.zip`
- 支持直接导入游戏的 `config` 文件夹
- 支持浏览：
  - 卡牌
  - 仪式
  - 事件
  - 结局
  - 后日谈
- 支持查看结构化信息
- 支持查看带注释的原始配置
- 支持在条目之间点击预览跳转
- 支持手机和电脑使用

## 工作方式

页面不会向仓库或服务器上传游戏配置。

用户导入本地 `config.zip` 或 `config` 文件夹后，浏览器会在本地：

- 读取源文件
- 解析配置
- 提取注释
- 建立索引
- 把解析结果缓存到浏览器本地

如果用户更换了游戏配置，需要重新导入一次。

## 项目结构

```text
sultan-config-reader/
├─ docs/
│  ├─ index.html
│  ├─ app.js
│  ├─ styles.css
│  ├─ translation-dicts.js
│  ├─ .nojekyll
│  └─ vendor/
│     └─ jszip.min.js
├─ README.md
└─ .gitignore
```

说明：

- `docs/` 是实际部署目录
- `docs/vendor/jszip.min.js` 用于浏览器端解压 `config.zip`
- `docs/translation-dicts.js` 只保留少量人工校正的翻译规则，不包含游戏数据本体

## 如何部署

这是一个纯静态站点，可以直接部署到：

- GitHub Pages
- Cloudflare Pages
- 任意静态文件服务器

如果用 GitHub Pages，直接把发布目录指向 `docs/` 即可。

- 在线页面：
  [https://charleyz2021.github.io/sultan-config-reader/](https://charleyz2021.github.io/sultan-config-reader/)

## 如何使用

1. 打开网站。
2. 点击导入按钮。
3. 选择游戏的 `config.zip`，或直接选择 `config` 文件夹。
4. 等待浏览器在本地解析完成。
5. 在页面中搜索和查看配置。

## 依赖与限制

- 当前支持：
  - `config.zip`
  - 直接导入 `config` 文件夹
- 当前不优先支持：
  - `rar`
- 页面依赖浏览器本地缓存；清除浏览器站点数据后需要重新导入
