# 越野赛报名看板

中国与世界越野、超级越野的静态报名板。页面文字是简体中文。站点由 Junwei Zhang（北京）维护，用 GitHub Pages 从 `main` 分支根目录发布（仓库里有空文件 `.nojekyll`，避免 Jekyll 处理）。

页面不引用外部字体、脚本或 CDN，方便在中国大陆直接打开。

## 页面

- **报名中的比赛**：只显示 `status` 为 `open` 或 `late_open` 的记录。`late_open` 会标「补录」。报名截止日在本地日期起 14 天内的场次用暖色标出。可按中国（含港澳台）/国外、国家、报名截止、距离筛选。
- **即将举行的比赛 & 精英选手**：比赛日尚未结束的场次，含已经截止、放进档案的比赛，按日期排序。默认只看未来 90 天。没有核实名单时写「暂无已核实的官方或可靠媒体名单」。

报名已经截止的比赛不留在报名板上。

## 数据

| 文件 | 内容 |
| --- | --- |
| `data/races.json` | 仍可报名、补录中，或报名尚未开放的比赛 |
| `data/archive.json` | 报名已截止的比赛 |
| `data/elites.json` | 约 90 天内开赛、且名单来自官方入口或可靠媒体的选手 |

不知道的字段写 `null`。不要补猜日期、费用、名额、爬升或人名。`sources` 只放实际看过的网址。`last_checked` 是核对当天的 `YYYY-MM-DD`。

一条比赛的主要字段：`id`、`name_zh`、`name_en`、`country`、`region`（地区/城市）、`date_start`、`date_end`、`official_url`、`registration_url`、`registration_open`、`registration_close`、`late_registration`（`enabled`、`window`、`notes`）、`status`、`transport`、`scale_total`、`categories`、`entry_requirements`、`mandatory_gear`、`sponsors`、`organizer`、`sources`、`last_checked`。

`status` 只使用：

- `open`：报名窗口内
- `late_open`：正赛报名已过，补录、候补或慈善号码布等仍可申请
- `closed`：报名结束，应在 `archive.json`
- `upcoming_unknown`：日期或报名日还没公布

组别 `categories`：`name`、`distance_km`、`elevation_gain_m`、`cutoff_hours`、`quota_or_entrants`、`fee`（`amount` + `currency`）、`itra_points`、`notes`。

`country` 以「中国」开头的（含中国香港、中国台湾）算在「中国」筛选里。

## 每天更新

在仓库根目录：

```bash
node scripts/update-status.mjs --date 2026-11-10
node scripts/validate.mjs --date 2026-11-10
```

把日期换成当天。不写 `--date` 时，两个脚本都用 UTC 当天。

`update-status.mjs` 的规则：

- 截止日当天仍算开放。只有「今天 > `registration_close`」才关闭。
- 若 `late_registration.enabled` 为真，且没有写出结束日，或 `window` 里最后一个 `YYYY-MM-DD`（或 `window.end`）仍不早于今天，主报名截止之后改为 `late_open`，记录留在 `races.json`。
- 否则把记录从 `races.json` 移到 `archive.json`，`status` 改为 `closed`。
- 没有截止日的记录不搬移。已售罄但页面没写截止日期的场次，需要人工放进档案。
- 脚本不把档案里的比赛搬回来。

先演练、不写文件：

```bash
node scripts/update-status.mjs --date 2026-11-11 --dry-run
```

校验失败时不要提交。通过后再提交并推到 `main`。

人工增补时：只写看来源页的数字；新比赛放进 `races.json`；精英只在官方名单、赛事新闻稿或可靠媒体点名时写入 `elites.json`，并记下 `source_url`。

## 这次核对里故意留空的部分

2026-11-10 没有找到可引用的 2027 官方规程，因此没有编造这些赛事的日期和费用：环四姑娘山、大理 100、中国境内的 Ultra Gobi / 北京 TNF、UTMB 莫干山、宁海、黄山（雷越野）超级越野、长城 / 云丘山等。崇礼 168 只保留「每年约 1 月中旬开报、2027 日期未公布」。UTMB / CCC / OCC 的 2027 报名条件和比赛日，官网写的是即将公布。尤利安阿尔卑斯（克拉尼斯卡戈拉）首页为 Opening soon。

以下国际赛事在 2026-11-10 还没开放报名，所以没有放进报名板：泽加马（2027-01-11 起预报名）、锡永-齐纳尔（2027-04-02）、Tor des Géants（2027-02-01 起预报名）、Ultra Pirineu 100K 一般报名（2026-12-15）、马拉松德萨布勒（约旦站 2026-11-18、秘鲁站 2026-12-09）、科迪亚克（官网写即将开放，Index 优先约 2026-11-17）、Wildstrubel（2026-11-17 / 11-19）、留尼汪对角线（第三方估计 2027 年 1 月，官方未确认）、信越五岳 2027（已读页面仍是 2026 届）。云丘山 by UTMB 的 2026 届报名已关闭，且比赛日在 2026 年 10 月，未见 2027 开放页。

马德拉 MIUT 2027 的比赛日没有出现在已读的报名 FAQ 里，FAQ 写的开放窗口是 2026-10-12 至 10-16，因此放在档案。科修斯科 2026、香港 100 2027 的精英名单，这次没有读到可点名的当届官方名单。TransLantau 100 的五名选手来自 2026-10-20 对官网精英页的媒体摘录；2026-11-10 官网页面本身是前端渲染，静态抓取没有读出姓名。
