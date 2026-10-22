# AI 移植游戏导航

收录游戏**反编译移植 / 静态重编译 / 原生重写**项目的导航站，标注 AI 参与程度、可玩状态、GitHub 星数与最近更新。

## 收录原则
- 只收录需要玩家**自备正版游戏文件**的项目；本站不提供也不链接任何 ROM / ISO。
- 打包分发版权素材、"打开即玩"的项目不收录。

## 结构
| 路径 | 作用 |
|---|---|
| `data/projects.json` | 项目清单（手动 / 定期维护） |
| `data/status.json` | 星数、更新时间、最新 Release（Actions 自动生成） |
| `scripts/update-status.mjs` | 抓取 GitHub 状态 |
| `.github/workflows/update.yml` | 每周一自动运行，`projects.json` 改动时也会触发 |

## 添加项目
在 `data/projects.json` 里加一条：

```json
{"id":"唯一id","game":"中文名","game_en":"English","platform":"N64","project":"项目名",
 "type":"decomp|recomp|port","ai":"ai|assist|none|unknown",
 "status":"released|beta|wip|decomp","repo":"owner/name","note":"一句话简介","featured":false}
```
没有 GitHub 仓库时用 `"url"`；地址未核实时用 `"search":"关键词"`。

## 本地预览
```bash
python3 -m http.server 8000
```
