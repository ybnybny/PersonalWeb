# 赛博串门（Cyber Visiting）— 项目规格文档

> 本文档是**唯一权威的项目说明书**，供其它 AI Agent / 开发者从零实现本项目时阅读。
> 目标读者：具备前端与 Supabase 基础知识的实现者。站主（用户）为零基础，文档应尽量自包含、可直接照做。

---

## 1. 项目概述

| 项 | 说明 |
|---|---|
| 项目名 | 赛博串门（Cyber Visiting） |
| 类型 | 个人主页（交互式、像素风/字符串画） |
| 托管 | GitHub Pages（纯静态） |
| 后端 | Supabase（Postgres + Auth + Row Level Security，免费层） |
| 前端 | 纯 HTML/CSS/JS + Supabase JS CDN，**无构建工具、无 npm**；单页外壳 `index.html` + 内容 iframe（主房间/森林/图书馆） |
| 语言 | 仅中文（暂不做多语言） |
| 核心概念 | 访客到访一间漂浮在数字宇宙中的**无名小屋**，由恒在的像素猫接待 |
| 风格参考 | A Dark Room（极简文字逐步揭示）、文字游戏（对话/选择）、星露谷物语（像素房间 + NPC 对话 + 点击物件） |

### 1.1 世界观（已定稿）
- 小屋**无名、无主**，漂浮在赛博数字空间（类似宇宙）中。
- 像素猫**一直存在**于小屋中，不是主人；**不询问访客来处**（不认为这重要）。
- 基调：赛博空间科幻背景 + **童话内核**（冷外壳、暖内核）。
- **无昼夜概念**（空间如宇宙），但可以**开关灯**（灯亮/灯灭）。
- 文案规范：**回避称谓与人称代词**（不用"你/我/访客/主人"），用氛围式措辞（如"推开门""灯亮了""便签已投递"）。

### 1.2 核心设计原则
1. **强交互趣味**：房间场景 + 像素猫 NPC 对话 + 点击物件探索。
2. **快捷直达不降效**：传送器（边栏菜单）随时快速切换，内容访问 ≤2 次点击。
3. **零构建**：CDN 引入依赖，克隆即开，推送即上线。
4. **安全第一**：管理员走 Supabase Auth，`service_role` key 绝不进入前端代码。
5. **氛围可调**：开关灯、背景音乐由访客自行切换，偏好记忆在 localStorage。

---

## 2. 技术栈与依赖

- 前端：原生 HTML/CSS/JavaScript；自有脚本用 ES Modules，第三方库用 `<script>` 全局引入（UMD）。
- Supabase：`@supabase/supabase-js` v2，通过 CDN `<script>` 引入 **UMD 全局构建**（暴露 `window.supabase`），`js/supabase.js` 用 `window.supabase.createClient(...)` 初始化。**依赖需锁定精确版本号**：实施时在 jsDelivr 查询 `@supabase/supabase-js` 最新稳定小版本并写死（示例 `@supabase/supabase-js@2.49.1`），避免大版本漂移破坏站点。
- 知识图谱：`cytoscape` 通过 CDN `<script>` 全局引入（暴露 `window.cytoscape`），同样锁定精确版本（示例 `cytoscape@3.30.2`）。森林为**朴素平面图，不做光效**。
- 图谱布局：`cytoscape-fcose` 通过 CDN `<script>` 全局引入，同样锁定精确版本（示例 `cytoscape-fcose@2.2.0`），注册为 cytoscape 的 fcose 布局扩展，用于固定 `pinned` 节点（见 §10.2）。
- Markdown：图书馆正文用 Markdown 渲染（`marked` CDN `<script>` 全局引入，暴露 `window.marked`，锁定精确版本，示例 `marked@12.0.2`），支持插图；渲染结果统一经 **DOMPurify**（CDN `<script>` 全局引入，暴露 `window.DOMPurify`，锁定精确版本，示例 `dompurify@3.2.4`）净化，防止 XSS（访客内容同样适用，见 §9）。
- **第三方库统一全局引入**：supabase-js / cytoscape / cytoscape-fcose / marked / DOMPurify 均用 `<script>` 标签全局引入（不 import），自有脚本（ES Modules）经 `window.*` 访问这些全局库。
- 插图托管：正文/日志插图用 **Supabase Storage**（public bucket `images`），后台直接上传、公开页经 public URL 加载（见 §8.5）。
- 字体：系统等宽字体栈（见 §6 视觉规范），不额外引入字体文件（除非用户日后要求）。
- 视觉素材：不使用位图——猫用 ASCII、地图与物件用 CSS 像素画（见 §5.7）；**禁止使用星露谷等受版权保护的素材**；背景音乐仅限原创或 CC0/CC-BY 音频。

---

## 3. 空间与页面结构

GitHub Pages 零配置托管根目录下的页面：常驻外壳 `index.html`（承载边栏与音乐播放器）+ 3 个内容页 `home.html`/`forest.html`/`library.html`（在外壳 iframe 内切换）+ 独立后台 `admin.html`。

### 3.1 空间总览

| 空间 | 功能 | 页面 |
|---|---|---|
| 主房间（无名，"凸"字形） | 首页，一切中心 | `home.html`（外壳 `index.html` 内的内容页） |
| 森林（借用"数据结构"概念，非真实森林） | 知识&兴趣图谱 | `forest.html`（内容页） |
| 图书馆（Markdown 档案馆） | 作品&笔记 | `library.html`（内容页） |
| 后台（无房间设定、不对外展示） | 管理面板 | `admin.html`（独立页，不进外壳） |

### 3.2 外壳与全局边栏（传送器 + 开关灯 + 音乐）
- **外壳 `index.html` 常驻**：承载全局边栏与音乐播放器，内容页（主房间/森林/图书馆）在其中的 `<iframe>` 内切换；外壳不重载，因此音乐**自动续播、零中断**。
- 边栏位于主房间范围之外，**常驻于外壳**，覆盖三个公开房间。
- 内含：**传送器**（边栏切房菜单）、**开关灯**、**音乐控制**。
- 开关灯默认**开灯**；状态存 `localStorage['cv_light']`（`'on'`/`'off'`）。
- 音乐状态存 `localStorage['cv_bgm']` = `{ on, trackIndex, currentTime }`（默认 `{ on:true, trackIndex:0, currentTime:0 }`）。播放器为外壳内的常驻 `<audio>`，内容页经 `postMessage` 控制。
- **跨 iframe 消息协议**（同源，`postMessage`；外壳与内容页监听消息时均须校验 `event.origin` 与本页同源，忽略异源消息）：
  - 外壳 → 内容：`{ type:'light', value:'on'|'off' }`、`{ type:'music', action:'play'|'pause'|'next'|'prev', startle:boolean }`；`startle` 表示是否惊扰猫（仅用户手势触发的指令为 `true`，自动续播/自动切歌为 `false`）。内容页加载时主动读 `cv_light`/`cv_bgm` 初始化。
  - 内容 → 外壳：`{ type:'navigate', room:'home'|'forest'|'library' }`（门）、`{ type:'music', action:… }`（唱片机，仅在用户手势时发送）。
  - 防消息回路：内容页**唱片机仅在用户手势时向外壳发送** `music` 指令；收到外壳广播的 `music` 消息只用于**同步自身显示状态**（播放中/暂停/曲目），不回发指令。猫仅对 `startle:true` 的消息触发受惊（见 §5.6）；**自动续播、一首播完自动进入下一首以 `startle:false` 广播**，仅同步唱片机显示、猫不因此受惊。
  - 开关灯：外壳切换自身 `data-light` 并广播给内容 iframe；内容页同步设置自身 `data-light`（见 §6.1）。
- **URL 路由**：外壳读取 `?room=home|forest|library`（默认 `home`）决定初始内容页，切换房间时用 `history.pushState` 更新 URL，刷新/前进后退保持当前房间。
- **移动端**：暂不做移动端适配；移动端进入时外壳显示全屏提示「移动端暂未建设，建议前往 pc 端访问」，不渲染内容（见 §10.0）。

### 3.3 主房间布局（"凸"字形，俯视）

```
           主房间（"凸"字形，俯视）
  ┌─────────────────────────────────────────────┐
  │           🖥 飞船控制台（上方靠墙正中）          │
  │           ① 航行日志   ② 通讯坐标              │
  │                                             │
  │  🚪 门·森林                    🚪 门·图书馆    │
  │   （开门）                      （开门）       │
  │                                             │
  │       🐱 猫猫（自由移动，无固定位置）           │
  │                                             │
  │  📻 唱片机                          📋 留言板 │
  │   （音乐）                          （提问箱）  │
  │        ┌──────────────────┐                 │
  └────────┤  小门厅（视觉入口）├─────────────────┘
           │  无入口，凭空出现  │  ← 凸出部分
           └──────────────────┘
```

- **飞船控制台**：主房间上方靠墙正中间；两个页签——① 航行日志（个人简介）② 通讯坐标（友链）。
- **小门厅**：主房间下方正中凸出的视觉入口，无入口（凭空出现）。访客**无化身角色**，全程以鼠标点击与悬停（hover）交互（移动端一律拦截，不做触屏点按兜底，见 §10.0）。
- **唱片机 / 留言板**：分别位于主房间左、右墙面靠下处（唱片机=音乐、留言板=提问箱），见上方示意图；二者均在主房间墙面上、不在门厅内。
- **门·森林 / 门·图书馆**：主房间左右墙，鼠标悬停（hover）靠近门时显示「开门」按钮。
- **像素猫**：无固定位置，随机转移位置、切换待机动作；不主动靠近访客；恒在——主房间、森林、图书馆各内容页都挂载猫组件（切房即重新在场，不做跨房位置连续）。
- **生态物件**：窝、电脑桌等；电脑桌可点开内置**贪吃蛇小游戏**，其余可做彩蛋交互或纯装饰。
- **简介文字**：铺在**主房间底部墙内**（小门厅凸出部分的上方），随开关灯切换——
  - 开灯：`一间飘在数据海的小屋。没有名字。灯亮着。`
  - 关灯：`一间飘在数据海的小屋。没有名字。灯灭了。`

### 3.4 动线
- 页面加载后**直接显示完整主房间地图，无进场动效**；小门厅作为地图上的凸出部分保留显示（视觉入口、无入口、凭空出现）。访客无化身角色，全程以鼠标点击与悬停（hover）交互。
- **主房间 ↔ 森林、主房间 ↔ 图书馆**：双向直连——主房间左右墙各一扇门；森林、图书馆内也各有一扇「门·主房间」。悬停（hover）到门旁显示「开门」按钮，点击经 `postMessage` 通知外壳切房。
- **森林 ↔ 图书馆**：二者之间**无直连门**，只能通过**传送器**（边栏）来往。
- 传送器直达、无「开门」提示：点击即切房；门则需要先悬停（hover）出现「开门」。
- 切房不重载外壳：音乐持续播放；内容页（含猫组件）重新挂载，猫不做跨房位置连续。

---

## 4. 文件结构

```
e:\PersonalWeb\
├─ index.html              # 常驻外壳：全局边栏（传送器/开关灯/音乐）+ <audio> 播放器 + 内容 <iframe>
├─ home.html               # 主房间（内容页，在外壳 iframe 内展示）
├─ forest.html             # 森林（知识图谱，内容页）
├─ library.html            # 图书馆（Markdown 档案馆，内容页）
├─ admin.html              # 后台（独立页，不进外壳）
├─ css\
│  └─ style.css            # 全局主题（开灯/关灯两套 CSS 变量）与组件样式（外壳与内容页共用）
├─ js\
│  ├─ config.js            # Supabase URL + anon key（公开，安全）
│  ├─ supabase.js          # 初始化 Supabase 客户端（读 window.supabase 全局）
│  ├─ settings.js          # 偏好管理：开关灯、背景音乐状态（读写 localStorage）
│  ├─ ui.js                # 共享 UI：房间外壳、ASCII 装饰、toast（内容页使用；边栏由 shell.js 负责）
│  ├─ shell.js             # 外壳逻辑：URL 路由（?room=）+ 边栏 + 播放器 + 跨 iframe 消息广播
│  ├─ npc.js               # 像素猫对话与行为（状态机 + 打字机 + 选项 + 随机移动/待机，不跟随、不主动靠近；经 postMessage 响应灯/音乐事件）
│  ├─ home.js              # 主房间逻辑（控制台/留言板/门/生态物件）
│  ├─ forest.js            # 森林图谱（Cytoscape.js）
│  ├─ library.js           # 图书馆（Markdown 渲染 + 标签检索）
│  └─ admin.js             # 后台登录与管理
├─ assets\
│  └─ audio\               # 背景音乐（原创或 CC0/CC-BY 授权音频，统一 mp3）
│     ├─ bgm-1.mp3
│     └─ bgm-2.mp3
├─ sql\
│  └─ schema.sql           # 建表 + RLS 策略 + 种子数据（§8 的 SQL 脚本）
├─ docs\
│  └─ PROJECT_SPEC.md      # 本文档
└─ README.md               # 面向零基础站主的部署与日常使用指南
```

> 页面脚本建议用 ES Modules（`<script type="module" src="js/home.js">`），并在每个页面按需 `import` 共享模块；第三方库（supabase-js / cytoscape / fcose / marked / DOMPurify）在各页面 HTML 中先以普通 `<script>` 全局引入，自有模块经 `window.*` 访问。

---

## 5. 宿主 NPC：像素猫

### 5.1 角色设定
- **无名**：没有名字，回避称呼（被问"你是猫吗 / 咪咪"等时，以"不知道""……"回应）。
- **非主人**、不问来处；恒在——并非不能离开小屋，只是**从未想过离开**，就一直这样存在着。
- **性格**：天然呆、恶趣味、宅宅、易受惊。
- **活动范围**：恒在，出现在主房间、森林、图书馆（各内容页均挂载猫组件）。
- **位置**：无固定位置；每隔一段时间随机转移位置、切换待机动作；不跟随光标、不因光标靠近而主动走近。
- **接触偏好**：不喜欢近距离接触、被摸；不喜欢人多的地方。
- **身世补充设定**：像素猫的部分台词与记忆是站主现实生活的投影（如舍友、食堂、校园跑等），故事内不点破；实现者勿删改这类台词。

### 5.2 外观与形象
- **配色**：猫为 ASCII 单色，颜色**跟随文字颜色**（开灯=黑色、关灯=白色），用 CSS `currentColor` 实现，自动适配两种模式，无需两套图。
- **像素立绘来源**：无需站主亲自画图——猫由 ASCII 直接生成（内嵌 `js/npc.js`）；CSS 像素画用于地图/房间物件（见 §6.3）。**不使用 PNG 精灵图**。
- **ASCII 造型**（定稿）与动画帧集见 §5.7：

```
待机           眨眼           发呆           睡觉           炸毛           走路①          走路②
  /\_/\         /\_/\         /\_/\         /\_/\         /\/\/\         /\_/\          /\_/\
 ( o.o )       ( -.- )       ( ° ° )       ( -.- ) zZ    ( O.O )!       ( o.o )        ( o.o )
  > ^ <         > ^ <         > ^ <         > ^ <          >  <           > ^ <          < ^ >
```

### 5.3 说话风格与口癖
- **简单句**：几乎只有基本谓宾结构的短句、简单词。
- 描述复杂/抽象事物用**简单词意向组合**（如把太阳解释为"很大很烫的球形灯"）；意向须符合"电子宇宙漂流、不爱出门"的背景（不能把灯说成"摘到房间里的太阳"）。
- **不会说否定句与被动句**（但能听懂）。
- **无寒暄**；不称呼访客（省略主语）。
- 口癖（「不知道」是否定句的口癖例外，其余遵循"不说否定句"）：
  - 「不知道」
  - 「nia」句末语气词（代替"啊"等）
  - 「rrrrrrrr」尴尬 / 激动 / 受惊吓
  - 「Ya？」疑问、困惑
  - 「Da」随意的认可
  - 「Ya！」突然受惊
  - 「quee……」感慨、紧张

### 5.4 对话与互动（`js/npc.js`）
轻量状态机，接口约定：

```
NpcState  = { idle, chat, startle, sleep, wander }            // 顶层状态（startle=受惊，普通受惊与炸毛共用）
NpcAction = { nap, compute, draw, daze, eat, tinker }         // 待机动作（nap=睡觉 compute=打电脑 draw=画画 daze=发呆 eat=吃东西 tinker=捣鼓机械零件）

Npc.say(text, {speed})            // 打字机逐字输出到对话面板
Npc.ask(question, options[])      // 展示选项按钮，返回用户选择
Npc.goto(state, {action})         // 状态切换；action 可选，用于强制指定待机动作（不传时 idle 随机选择、sleep 固定 nap）
Npc.skip()                        // 跳过当前打字，立即显示完整文本
```

流程与选项树：
- 对话面板固定在内容页底部，随对话出现/隐藏。
- 猫猫**不主动寒暄、不领路、不引导物件**。
- **点击猫猫**：随机对话一句 → 跳出固定选项：「你……？」「这里……？」「想聊聊天」。
  - 「你……？」→ 二级选项：「你是猫吗」「你其实就是猫吧」「咪咪」→ 猫猫回复「不知道」「……」一类。
  - 「这里……？」→ 用简单句介绍小屋。
  - 「想聊聊天」→ 随机闲聊/吐槽。
- 猫猫**恒在**：访客切房到森林/图书馆时猫也在场（各内容页独立挂载猫组件，不做跨房位置连续）。

### 5.5 行为与待机
- 小屋空间本身无昼夜视觉变化（见 §1.1），此处「白天 / 夜晚」指访客设备的当地时间，仅用于决定猫的待机动作。**夜晚 = 当地 22:00–07:00**，其余为白天。
- 待机动作（按现实时间）：
  - **白天**：睡觉、打电脑、画画、发呆、吃东西、捣鼓机械零件。
  - **夜晚**：睡觉、打电脑（切换频率变低）。
- 「打电脑」涵盖写代码、打游戏等多种事项，动画动作一致。
- 每隔一段时间随机转移位置并切换待机动作。
- 生态物件（联动位置）：
  - **窝**（不叫"猫窝"）：夜晚睡觉必在此处；白天睡觉、发呆、打电脑、画画、吃东西可能在此处，也可能在别处。
  - **电脑桌**：除睡觉外的任何活动都可能在此处（此物件同时也是访客可玩的贪吃蛇入口）。
  - **地板**（地图空白区域）：任何活动都可能在此处。
  - 规则优先级：窝的「夜晚睡觉必在窝」优先于地板「任何活动」。
- **状态 ↔ 动作映射**：
  - `wander` = 移动中（走路帧）。
  - `idle` = 随机选一个 `NpcAction` 执行；白天 6 种全量、夜晚仅 `nap`/`compute`。
  - `sleep` = `nap`（位置受上面生态物件规则约束）。
  - `startle` = 受惊，使用「炸毛」帧，2 秒；无台词为普通受惊，有台词为炸毛彩蛋（二者同一套动作）。
  - `daze`（发呆）仅作为 `idle` 内的自发动作出现。
  - **「不受惊扰」判定统一按动作帧**：凡当前显示睡觉帧（`nap`）或发呆帧（`daze`）即不受惊扰（无论处于 `sleep` 状态还是 `idle` 随机到该动作）；炸毛彩蛋除外（见 §5.6）。

### 5.6 与系统联动
- 猫组件挂载于内容页；开关灯/音乐由外壳控制，经 `postMessage` 广播到内容页，`npc.js` 监听后响应。
- **开关灯**：若猫当前显示睡觉帧或发呆帧，**不受惊扰、不打断**；否则停下当前状态 → 受惊（`startle`，炸毛帧）2 秒 → 恢复原状态（普通受惊**无台词**）；滑动 10 秒窗口内灯光状态切换 ≥5 次（开→关、关→开各计 1 次）触发「炸毛」彩蛋（有台词，见 §5.8）。
- **音乐**（开始/停止/切歌）：仅**用户手势**触发的播放/暂停/切歌惊扰猫（对应广播 `startle:true`），且同样遵守「显示睡觉/发呆帧不受惊扰」；**自动续播、一首播完自动进入下一首广播 `startle:false`，不惊扰**。滑动 10 秒窗口内切歌 ≥5 次触发「炸毛」彩蛋。
- **炸毛优先级最高**：达到阈值即**强制打断任意状态（含显示睡觉/发呆帧时）**进入炸毛（有台词，与普通受惊同一套动作），结束后回到先前状态。
- 无"翻译接口"（多语言已移除）。

### 5.7 技术实现（定稿）
- **立绘来源**：猫用 A 纯 ASCII（`<pre>` 文本帧，按状态切帧），内嵌在 `js/npc.js` 常量中（不额外维护 `assets/npc-cat-ascii.txt`）；B CSS 像素画用于地图/房间物件；**不使用 C PNG 精灵图**。
- **动画方式**：
  - ASCII 版：JS 按状态切换文本帧 + CSS 呼吸/眨眼。
  - 最小帧集：待机（呼吸 2 帧，即 §5.2 的「待机」+「眨眼」）、走路（2 帧，见 §5.2）、发呆（1 帧）、睡觉（1 帧）、炸毛（1 帧，受惊与炸毛共用）；动作类（打电脑/画画/吃东西/捣鼓机械零件）首版共用「待机」帧静态占位（后续再补专属帧）。
  - 遵守 `prefers-reduced-motion`：关闭动画时降为静态帧。
- **移动实现**：
  - 定位：房间容器内绝对定位，百分比坐标，锚点=猫底部中心。
  - 随机游走：每 15–40 秒（随机）选新目标点 → 移动 2–4 秒（CSS transition 或 rAF 缓动）→ 随机待机动作持续 20–60 秒 → 循环。
  - 夜晚降频：仅"睡觉/打电脑"，游走与动作切换周期 ×2~3。
  - 在场：`forest.html`/`library.html` 同样挂载猫组件（体现"恒在"），活动范围限定在可视区域。
  - 打断：开关灯、开始/停止/切歌 → 若当前显示睡觉帧/发呆帧则不受惊扰；否则暂停当前活动 → 受惊（炸毛帧）2 秒 → 恢复原状态；炸毛彩蛋优先级最高，见 §5.6。
  - 位置不持久化：刷新后随机生成，不写 localStorage。
- **炸毛彩蛋阈值**：滑动 10 秒窗口内灯光状态切换 ≥5 次（开→关、关→开各计 1 次），或滑动 10 秒窗口内切歌 ≥5 次 → 触发「炸毛」（优先级最高，无视"睡觉/发呆除外"）。

### 5.8 对话库（台词，定稿）

台词遵循 §5.3 说话风格：简单句、无否定句/被动句（"不知道"为口癖例外）、无寒暄、不称呼访客、不用"猫猫"自称（猫猫对自己无概念）。

**① 点击猫猫 · 随机开场白**（先随机一句，再跳出固定选项）：
```
……
Ya？
rrrrrrrr
nia。
quee……
Ya！
```

**② 「你……？」→ 二级选项回复**（随机）：
- 你是猫吗 → 不知道。 / ……
- 你其实就是猫吧 → …… / 不知道。
- 咪咪 → …… / ……咪咪？Da。

**③ 「这里……？」→ 介绍小屋**（随机）：
```
小屋漂在数据海。名字……不知道。
森林在门后面。走进去，会碰到很多念头。
图书馆有书。书，一点点。
这里，很安静。
```

**④ 「想聊聊天」→ 随机闲聊**（随机）：
```
薯条，好。
冰淇淋，好。
蘑菇，好。
香菜，讨厌。薄荷，荆芥，都好。为什么……不知道。
食堂的饭……不知道。舍友，吃得很香。
体育课和校园跑……为什么。
校园跑，讨厌。
要学的东西，好多……
难懂的事，好多好多。
vibe coding……好累……为什么……
困……
为什么……
想干的事，好多……
画画……难。想描述想象的东西，拿起了笔。
音乐，可以连接情感。
努力，也是天赋吧。Da。
朋友，喜欢。Da。
学校，好多鸟。
喜鹊，灰喜鹊，警惕。盯着看，就飞上树，留一个放哨。
咕咕，傻傻的。
活着，很神奇。
外面……不知道。
好容易累……
大脑，很神奇。
念头，从脑子里长出来。
存在……是什么。
逻辑，喜欢。一步一步。
数学……必须学好多好多。
明明刚刚能通的……为什么。
跑通了rrrrrrrrrrrr
这些想法，从哪来的……不知道。
未来，会怎么样呢？
```

**⑤ 开关灯 / 切歌**：无台词（仅受惊 2 秒，与炸毛同一套动作）。**炸毛彩蛋**有台词：
```
Ya！rrrrrrrr
Ya！
quee……rrrrrrrr
```

---

## 6. 视觉与交互规范

### 6.1 开关灯（两套配色，CSS 变量）
- `:root` = **开灯**（明亮主题，默认）。
- `[data-light="off"]` = **关灯**（暗色主题，宇宙黑暗）。
- 开关灯为全局控件（边栏，位于外壳），**主房间/森林/图书馆三个公开房间同步生效**（后台 `admin.html` 不参与，固定白底黑字，见 §10.4）。
- 外壳切换自身 `data-light` 后，经 `postMessage` 广播给内容 iframe；内容页加载时先按 `cv_light` 设置自身 `data-light`（防闪烁），并监听广播实时同步。外壳与内容页定义同一套 CSS 变量。
- ASCII 与 CSS 像素画均用 `currentColor`，随文字色自动适配，无需两套版本。

建议基准（CSS 变量）：
- 开灯（白底黑字）：背景 `#ffffff`、文字 `#1a1a1a`、强调 `#005f5f`、边框 `#d5d0c8`；面板与背景同色、以边框区分。
- 关灯（黑底白字）：背景 `#000000`、文字 `#e6e6e6`、强调 `#00ffcc`、边框 `#2a2a3a`；面板与背景同色、以边框区分。

### 6.2 字体与字符串画
- 等宽字体栈：`'Cascadia Mono', Consolas, 'Courier New', monospace`。
- ASCII 装饰（`<pre>` 标签）：房间门框、分隔线、像素猫头像、标题横幅。
- 像素图渲染：对所有像素图加 `image-rendering: pixelated;`，避免放大后模糊。

### 6.3 房间场景（主房间）
- 以 CSS 网格/绝对定位 + ASCII 边框搭建"凸"字形主房间，内含可点击物件：飞船控制台、留言板、唱片机、门·森林、门·图书馆，以及生态物件（窝、电脑桌等）。
- 物件 hover 时高亮，并显示**系统发出的物品介绍卡**（悬浮提示，非猫台词）；猫不引导物件（见 §5.4）。
- 实现从简：猫用 ASCII、地图与物件用 CSS 像素画，不使用位图素材。

### 6.4 动效
- 打字机效果、光标闪烁、物件 hover 高亮。
- 尊重 `prefers-reduced-motion`：开启时关闭打字机动画，直接显示全文。

### 6.5 背景音乐（BGM）
- **唱片机**位于主房间；外壳边栏提供全局音乐控制。
- 播放器实现：外壳 `index.html` 内常驻 `<audio>`（**不再使用 player.html / 逐页 iframe**）。外壳不随切房重载，因此音乐**自动续播、零中断**。内容页（唱片机）经 `postMessage` 向外壳发送播放/暂停/切歌指令（仅在用户手势时发送），边栏直接操作外壳播放器；外壳执行后向内容页广播 `{type:'music', action, startle}`（`startle:true` 供猫受惊，`startle:false` 仅同步唱片机显示），唱片机收到广播只更新显示、不回发，避免消息回路；**自动续播、一首播完自动进入下一首以 `startle:false` 广播**，猫不因此受惊；外壳每 2 秒把 `currentTime` 写回 `localStorage['cv_bgm']`。
- 本地 `<audio>` 播放自有音频（原创或 CC0/CC-BY，放 `assets/audio/`），2 首循环，统一 mp3（兼容 Safari）。
- 控件：播放/暂停、上一首/下一首（无音量调节，用户自行调整设备音量）；状态持久化于 `cv_bgm`（`{ on, trackIndex, currentTime }`），刷新后从 `currentTime` 续播。
- 自动播放：**进入页面即尝试自动播放**（状态默认 `on:true`）；受浏览器自动播放策略限制时首次点击后才真正出声，并在边栏给出「点击任意处开始播放」提示；因外壳常驻，后续切房无需再次点击即可续播。
- 版权红线：**不得搬运受版权保护的音乐**；`README.md` 标注音频来源。
- 所有偏好键（`cv_light`/`cv_bgm` 等）均带 `cv_` 前缀，避免与同域名下其它 GitHub Pages 项目冲突。

---

## 7. 语言与文案约定

- **仅中文**：暂不做多语言系统；无 `i18n.js`、无语言切换/翻译接口。
- 数据表字段均为单一语言版本（中文内容，无 `*_en`）。
- **术语统一**：主房间物件「留言板」=「提问箱」（问答墙 + 投递表单），全文与后台 tab 均指同一功能；「传送器」= 边栏切房菜单。
- **回避称谓与人称代词**：猫猫台词与界面文案不使用"你/我/访客/主人"称呼访客，用氛围式措辞（如"推开门""灯亮了""便签已投递"）。访客的互动选项（如"你是猫吗"）不在此限，可自然提问。
- **"不说否定句"仅限猫猫台词**（见 §5.3）：界面/氛围文案不受此限，可使用"没有名字""摸不到"等否定措辞。
- 恢复双语的扩展点：加回 `*_en` 字段 + `i18n.js` 即可。

---

## 8. Supabase 数据模型与权限（`sql/schema.sql`）

### 8.1 表结构（SQL，可直接在 Supabase SQL Editor 执行）

```sql
-- 管理员表：与 Supabase Auth 用户关联
create table public.admins (
  id uuid primary key references auth.users(id) on delete cascade
);

-- 航行日志（个人简介，单行，id 恒为 1）
create table public.profile (
  id int primary key default 1 check (id = 1),
  space_id text not null default '',      -- 空间编号，存展示用字符串，如 ybnybny (YBN)
  status text not null default '',        -- 当前状态
  affiliation text not null default '',   -- 属空间（科幻措辞，内容为现实归属信息）
  log_md text not null default '',        -- 航行日志正文（Markdown）
  updated_at timestamptz not null default now()
);

-- 图书馆（Markdown 档案馆：作品与笔记统一，用标签区分）
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',       -- 列表摘要（后台编辑）
  content_md text not null default '',    -- Markdown 正文，可插图/链接
  tags text[] not null default '{}',      -- 标签，如 {"作品"} / {"笔记"}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 森林：知识图谱节点
create table public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  "desc" text not null default '',
  tags text[] not null default '{}',      -- 标签（标签名数组，颜色见 knowledge_tags）
  library_item_id uuid references public.library_items(id) on delete set null,  -- 关联图书馆文章（可空）
  x float not null default 0 check (x between 0 and 1),  -- 归一化坐标 0–1（相对画布宽高，原点左上角）
  y float not null default 0 check (y between 0 and 1),
  pinned boolean not null default false,  -- true=使用手动坐标，公开页锁定位置
  size int not null default 30            -- 节点直径（px，默认 30），渲染时作为节点宽高
);

-- 森林：节点标签（标签名 → 颜色）
create table public.knowledge_tags (
  name text primary key,
  color text not null default '#005f5f'
);

-- 森林：连线
create table public.knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  source uuid not null references public.knowledge_nodes(id) on delete cascade,
  target uuid not null references public.knowledge_nodes(id) on delete cascade,
  label text,
  check (source <> target)  -- 禁止自环
);

-- 提问箱
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(trim(content)) between 1 and 100),  -- 留言内容（必填，≤100 字）
  display_mode text not null default 'public'
    check (display_mode in ('public','private')),   -- 公开/不公开（二选一，默认公开）
  submitter_name text check (submitter_name is null or char_length(trim(submitter_name)) between 1 and 20),  -- 留言人（选填，≤20 字，留空 = 匿名，公开时显示「匿名」）
  submitter_email text check (submitter_email is null or submitter_email ~ '^[^@]+@[^@]+[.][^@]+$'),            -- 邮箱（选填，仅后台可见；首版不自动发邮件）
  hp text,                         -- 蜜罐字段：正常留空，机器人填写则拒绝
  status text not null default 'pending'
    check (status in ('pending','published','rejected')),
  answer text check (answer is null or char_length(answer) <= 500),  -- 回答（纯文本，≤500 字）
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

-- 友链（通讯坐标）
create table public.friend_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  desc text not null default '',
  avatar_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
```

字段语义：
- `profile`：航行日志四个字段——`space_id` 空间编号、`status` 当前状态、`affiliation` 属空间、`log_md` 正文（Markdown）。`space_id`/`status`/`affiliation` 采用科幻措辞包装、内容为现实信息（`affiliation` 即现实归属）；`space_id` 直接存展示用字符串。初始种子：空间编号 `ybnybny (YBN)`、当前状态 `计算机类大一生`、属空间 `北京科技大学（USTB）`。
- `library_items`：作品与笔记统一存于此，`tags` 区分类型（如 `作品` / `笔记`）并支持分类检索；正文为 Markdown，可插图；`summary` 为列表摘要（后台编辑，为空时公开页省略摘要项）。
- `questions` 表单标准：`content` 留言内容（必填、**≤100 字**，前后端双重限制）、`submitter_name` 留言人（选填、**≤20 字**，留空=匿名，公开时显示「匿名」）、`submitter_email` 邮箱（选填，仅后台可见；首版不自动发邮件，站主手动回复）、`display_mode` 公开/不公开（二选一、必选，默认 `public`）。`hp` 为蜜罐字段；`status`：`pending` → `published` / `rejected`；`answer` 为**纯文本**（非 Markdown、≤500 字，前后端双重限制）。
- `knowledge_nodes.x/y`：节点手动坐标，**归一化 0–1**（相对画布宽高，原点左上角）；渲染时乘以画布实际宽高换算为像素，后台拖拽时把像素换算回 0–1 存库。`pinned=true` 时公开页用该坐标锁定节点位置；`pinned=false`（默认）时由自动布局决定位置，`x/y` 存库值被忽略。`size` 为节点直径（px，默认 30），公开页渲染节点大小时使用。
- `knowledge_nodes.tags`：节点标签名数组；节点颜色取第一个标签在 `knowledge_tags` 中的颜色，无标签时用主题强调色。`library_item_id` 关联 `library_items`（可空），用于森林节点 ↔ 图书馆文章互链。
- `knowledge_tags`：标签名 → 颜色（如 `课程`/`兴趣`/`工具`），后台可增删改；改颜色后前端节点同步变色。
- `friend_links`：通讯坐标（友链），`url` 为对方地址，`sort_order` 控制顺序；`avatar_url` 可选，首版不渲染。

### 8.2 Row Level Security 策略

```sql
alter table public.admins          enable row level security;
alter table public.profile         enable row level security;
alter table public.library_items   enable row level security;
alter table public.knowledge_nodes enable row level security;
alter table public.knowledge_edges enable row level security;
alter table public.questions       enable row level security;
alter table public.friend_links    enable row level security;

-- 管理员判断函数（security definer，安全）
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

-- 公开可读：内容表
create policy "public read profile" on public.profile
  for select using (true);
create policy "public read library" on public.library_items
  for select using (true);
create policy "public read nodes" on public.knowledge_nodes
  for select using (true);
create policy "public read edges" on public.knowledge_edges
  for select using (true);
create policy "public read friend_links" on public.friend_links
  for select using (true);

-- 公开可读：仅已发布且公开的提问；不直接开放表查询，
-- 公开页面统一调用 get_published_questions()（不含邮箱等后台字段的列）。
-- 分页：page/page_size（默认 1/20，page_size 上限 100），总数用 get_published_questions_count()。
create or replace function public.get_published_questions(
  page int default 1,
  page_size int default 20
)
returns table (
  id uuid, content text,
  submitter_name text, answer text, created_at timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select id, content, submitter_name, answer, created_at
  from public.questions
  where status = 'published' and display_mode = 'public'
  order by created_at desc
  limit least(greatest(page_size, 1), 100)
  offset (greatest(page, 1) - 1) * least(greatest(page_size, 1), 100);
$$;

-- 已发布公开提问总数（配合分页）
create or replace function public.get_published_questions_count()
returns bigint
language sql stable security definer
set search_path = public
as $$
  select count(*) from public.questions
  where status = 'published' and display_mode = 'public';
$$;

-- 管理员可读全部提问（含 pending/private/邮箱）
create policy "admin select questions" on public.questions
  for select using (public.is_admin());

-- 公开可写：统一经 submit_question() 提交（security definer），
-- 不开放 questions 表的直接插入，权限与校验统一收口到函数与触发器；
-- 校验（蜜罐/限流/归一化）仍由 trg_questions_before_insert 兜底。
create or replace function public.submit_question(
  p_content text,
  p_display_mode text default 'public',
  p_submitter_name text default null,
  p_submitter_email text default null,
  p_hp text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_display_mode not in ('public','private') then
    raise exception 'invalid display_mode';
  end if;
  insert into public.questions (content, display_mode, submitter_name, submitter_email, hp)
  values (p_content, p_display_mode, p_submitter_name, p_submitter_email, p_hp)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.submit_question(text, text, text, text, text) from public;
grant execute on function public.submit_question(text, text, text, text, text) to anon, authenticated;

-- 安全：无论客户端传什么，插入时强制待审核状态、清空回答字段；
-- 蜜罐字段 hp 非空说明是机器人，直接拒绝
create or replace function public.questions_before_insert()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.hp, '') <> '' then
    raise exception 'spam rejected';
  end if;
  -- 简单全局限流：60 秒内已新增 5 条则拒绝下一条（配合前端频控，首版够用）
  if (select count(*) from public.questions where created_at > now() - interval '60 seconds') >= 5 then
    raise exception 'rate limited';
  end if;
  new.status := 'pending';
  new.answer := null;
  new.answered_at := null;
  new.hp := null;
  new.created_at := now();  -- 防客户端伪造时间戳
  new.submitter_name := nullif(trim(new.submitter_name), '');   -- 空白串归一为匿名
  new.submitter_email := nullif(trim(new.submitter_email), '');
  return new;
end;
$$;

create trigger trg_questions_before_insert
  before insert on public.questions
  for each row execute function public.questions_before_insert();

-- 仅管理员可写：内容表增删改
create policy "admin all profile" on public.profile
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all library" on public.library_items
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all nodes" on public.knowledge_nodes
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all edges" on public.knowledge_edges
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all friend_links" on public.friend_links
  for all using (public.is_admin()) with check (public.is_admin());

-- 仅管理员可写：提问箱审核/回答/隐藏（更新）
create policy "admin update questions" on public.questions
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin delete questions" on public.questions
  for delete using (public.is_admin());

-- 更新时间戳：内容表更新时自动刷新 updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profile_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

create trigger trg_library_updated_at
  before update on public.library_items
  for each row execute function public.set_updated_at();
```

### 8.3 Auth 与管理员创建
1. Supabase Dashboard → Authentication → Providers → 开启 **Email**（密码登录），并关闭「Confirm email」（首版不要求邮箱确认，否则首次登录需先点邮件链接，影响本地调试与体验）；同时在 Authentication 设置中关闭「Allow new users to sign up」（禁止公开注册，仅保留管理员账号）。
2. 创建管理员账号：Authentication → Users → Add user，设置邮箱与密码。
3. 在 SQL Editor 执行（把 `邮箱对应的 user id` 替换为实际 UUID，可在 Auth 用户列表查到）：
   ```sql
   insert into public.admins (id)
   values ('<该用户的 UUID>');
   ```
4. Authentication → URL Configuration → Site URL 设为 GitHub Pages 最终域名（如 `https://<user>.github.io/<repo>/`），并加入 Redirect URLs 白名单。
5. 本地开发（Live Server，如 `http://127.0.0.1:5500/`）时，把本地地址一并加入 Redirect URLs 白名单，否则本地测试邮箱登录可能失败。

### 8.4 种子数据
`sql/schema.sql` 末尾提供可选 `insert`：一行 `profile`（空间编号/状态/属空间）、3–5 条 `library_items`（含 `作品`、`笔记` 标签与 `summary` 示例）、若干 `knowledge_nodes`（含 `pinned=true` 坐标、`tags` 与 `library_item_id` 关联示例）与 `knowledge_edges`、3 条 `knowledge_tags`（含颜色）、1–2 条 `friend_links`（`name`/`url` 用占位示例，`url` 先填 `https://example.com`，站主日后替换）。

### 8.5 插图存储（Supabase Storage）
- 插图（航行日志/图书馆正文内的图片）统一存 Supabase Storage 的 **public bucket** `images`，后台直接上传、公开页经 public URL 加载。
- 建 bucket 与策略：`storage.objects` 属 `supabase_storage_admin` 所有，SQL Editor 无权建策略（会报 `must be owner of table objects`），**改为在 Dashboard 手动配置**：Storage → New bucket 建 public bucket `images`；再为该 bucket 建策略，允许 `authenticated` 角色 INSERT/UPDATE/DELETE（USING 与 WITH CHECK 均 `bucket_id = 'images'`）。公开读取由「Public bucket」直接提供。
- 上传路径建议 `public/<时间戳或uuid>.<ext>`；公开 URL 形如 `https://<项目>.supabase.co/storage/v1/object/public/images/<路径>`；后台前端限制单文件 ≤5MB、类型 png/jpg/webp/gif。

---

## 9. 安全红线（必须遵守）

1. `js/config.js` 只放 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY`（这两个是公开的，安全）。
2. **`service_role` key 严禁出现在任何 HTML/JS/CSS 或前端仓库文件中**。本项目前台完全不需要它。
3. **禁止在前端硬编码管理员密码或"固定密匙"**。管理员唯一识别方式是 Supabase Auth 登录后 `auth.uid()` 命中 `admins` 表。
4. 前端对写操作的"鉴权"不依赖隐藏按钮：真正的防线是 RLS 策略；前端仅根据登录态显示/隐藏后台入口。
5. 提交提问时：`submitter_email` 仅存后台；公开读取统一走 `get_published_questions()`（只返回已发布且非私密的行，且不含邮箱），公开页面不得渲染邮箱。
6. **防 XSS**：访客提交内容（`questions.content`、`questions.submitter_name`）与回答（`questions.answer`）均为**纯文本**，公开渲染前必须 `textContent` 转义，不走 Markdown；管理员 Markdown 正文（`log_md`/`content_md`）渲染统一走 `marked` + DOMPurify，不得将未净化的 HTML 直接插入 DOM。

---

## 10. 页面与外壳实现要点

### 10.0 `index.html` + `shell.js`（常驻外壳）
- 解析 `?room=home|forest|library`（默认 `home`），把对应内容页设为 `<iframe>` 的 `src`；切房时用 `history.pushState` 更新 URL；同时监听 `popstate`，浏览器前进/后退时按 `?room=` 同步当前内容页。
- 承载全局边栏（传送器/开关灯/音乐）与常驻 `<audio>` 播放器（§6.5）。
- 开关灯：切换外壳自身 `data-light` → 写 `cv_light` → 广播 `{type:'light', value}` 给内容 iframe。
- 接收内容页消息 `{type:'navigate', room}`（门切房；传送器在边栏内由外壳直接切房）、`{type:'music', action}`（唱片机）；向内容页广播 `{type:'music', action, startle}`（`startle:true` 供猫响应，`startle:false` 仅同步唱片机显示）。监听消息时校验 `event.origin` 与本页同源，忽略异源消息。
- 不渲染任何房间内容；房间视觉全部由内容页负责。
- **移动端拦截**：外壳检测移动端（视口宽度 < 768px 或 `(pointer: coarse)` 命中）时显示全屏提示「移动端暂未建设，建议前往 pc 端访问」，不渲染内容 iframe；桌面端正常进入。触屏设备命中 `pointer:coarse` 同样拦截，因此全程不做触屏点按兜底、仅保留 hover。
- `index.html` 设置 `<title>赛博串门</title>`、`<meta name="description">` 与 emoji favicon（SVG data-URI，内嵌猫 emoji，如 `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐱</text></svg>">`）。

### 10.1 `home.html` + `home.js`（主房间，内容页）
- 渲染"凸"字形主房间与物件（§3.3 布局）。
- **飞船控制台**（面板）：① 航行日志（读 `profile`：`space_id`/`status`/`affiliation` 作为面板头部元数据块展示，`log_md` 正文经 `marked` + DOMPurify 渲染）② 通讯坐标（读 `friend_links`，首版纯文字列表，不渲染 `avatar_url`）。
- **留言板**（面板，分「查看留言 / 投递便签」两个页签）：查看留言 = 已发布问答墙（调用 `get_published_questions(page, 20)` + `get_published_questions_count()`，分页「加载更多」）；投递便签 = 投递表单（经 `supabase.rpc('submit_question', {...})` 提交）。投递表单字段：**留言内容**（`content`，必填、≤100 字，前端 `maxlength=100` 并显示计数）、**留言人**（`submitter_name`，选填、≤20 字，前端 `maxlength=20`，留空=匿名）、**邮箱**（`submitter_email`，选填，仅后台可见，首版不自动发邮件；前端 `type="email"` 格式校验、后端 check 兜底）、**公开/不公开**（`display_mode`：`public`/`private`，二选一必选，默认公开）；表单含隐藏蜜罐字段 `hp`，并做简单前端频控（短时间重复提交提示稍后再试）。公开问答墙：`public` 题目显示留言人或「匿名」（留言人留空时）与回复内容（已回答显示答案，未回答显示「待回复」占位）；**不显示提问日期与回答日期**；`private` 不显示。访客提交的 `content`、`submitter_name` 与回答 `answer` 均为纯文本，渲染前必须 `textContent` 转义（见 §9）。
- **唱片机**：经 `postMessage` 触发外壳音乐播放。
- **门·森林 / 门·图书馆**：鼠标悬停（hover）靠近门显示「开门」，点击经 `postMessage` 通知外壳切房。
- **像素猫**：`npc.js` 对话与行为（随机转移、待机动作，不跟随、不主动靠近访客）；无引导、无寒暄；监听外壳广播的灯/音乐事件（§5.6）。
- **生态物件**：窝/电脑桌等；电脑桌点开内置贪吃蛇小游戏（点「开始游戏」才开始，方向键/WASD 移动、空格暂停、撞墙或自撞结束、可重开；本机记录前十高分榜，进入榜单需留昵称）。
- **简介文字**：铺在主房间底部墙内（小门厅凸出部分上方），随开关灯切换（开灯/关灯两版文案，见 §3.3）。
- 边栏（传送器 + 开关灯 + 音乐）由外壳承载，本页不含。

### 10.2 `forest.html` + `forest.js`（森林，内容页）
- 读取 `knowledge_nodes` + `knowledge_edges`，用 Cytoscape 渲染**朴素平面图**（无光效）；布局采用 `cytoscape-fcose`，用 `fixedNodeConstraint` 将 `pinned=true` 的节点固定在其 `x/y` 坐标（0–1 归一化）、不参与自动排布，`pinned=false`（默认）的节点由自动布局决定位置；`size` 作为节点直径（px，默认 30）渲染。**坐标换算基准**：`fixedNodeConstraint` 使用模型坐标，约定以初始未缩放画布宽高为基准，pinned 节点 position =（x×画布宽, y×画布高）；后台拖拽松手时用节点模型坐标除以画布宽高换算回 0–1 写库。**坐标校准注意**：fcose 以画布中心为原点，与 0–1 左上角原点存在偏移，实施时须实测校准；若偏差明显，改为「先对非固定节点跑自动布局，再对 `pinned` 节点用 `node.position()` 直接设定位置」。连线（边）的 `label` 不显示，仅存数据库备用。
- 交互：拖拽画布（pan）、滚轮缩放（zoom）、点击节点在侧栏展开简介 `desc`（Markdown，经 `marked`+DOMPurify 渲染）、彩色标签（`tags`，颜色随 `knowledge_tags`）与关联文章（`library_item_id`，可点「前往图书馆查看」）；**节点颜色 = 第一个标签的颜色**（无标签用主题强调色）；**公开页禁用节点拖动**，只有后台可拖节点写坐标。
- **fcose 注册**：`cytoscape-fcose` 的 UMD 构建只暴露 `window.cytoscapeFcose`、不会自动注册，需在脚本中执行 `window.cytoscape.use(window.cytoscapeFcose)` 后方可使用 `name:'fcose'` 布局。
- **门·主房间**：与主房间的门一致——悬停（hover）到门旁显示「开门」，点击经 `postMessage` 通知外壳切回主房间。
- 挂载 `npc.js` 猫组件（体现"恒在"，见 §5）；监听外壳广播的灯/音乐事件（§5.6）。
- 入口处铺一行**森林**的氛围简介文字（固定单版文案，不分开灯/关灯两版；文字颜色随 `data-light` 主题变化）：`这是森林。摸不到。但走进去，会碰到很多念头。`
- 森林不按"树种"区分样式（借用数据结构"森林"概念）。

### 10.3 `library.html` + `library.js`（图书馆，内容页）
- 读取 `library_items`，**默认按 `updated_at` 倒序**，**分页展示**：每页上限 20 条，提供分页控件（加载更多或页码）；支持**按标签分类检索**（按 `tags` 筛选，标签筛选与分页组合生效，Supabase 查询用 `.contains('tags', [tag])` + `.range()` 并 `count` 总数）；标签筛选按钮的标签列表通过**单独全量查询 `library_items.tags`（不分页）聚合去重**生成（如作品/笔记），随数据自动更新，不硬编码。
- 入口处铺一行**图书馆**的氛围简介文字（固定单版文案，不分开灯/关灯两版；文字颜色随 `data-light` 主题变化）：`图书馆。书架很大，书还不多。慢慢会多起来。`
- 挂载 `npc.js` 猫组件（体现"恒在"，见 §5）；监听外壳广播的灯/音乐事件（§5.6）。
- **门·主房间**：与主房间的门一致——悬停（hover）显示「开门」，点击经 `postMessage` 通知外壳切回主房间。
- 正文 Markdown 渲染（可插图、可链接）；渲染统一经 `marked` + DOMPurify 净化（见 §9）。
- 列表视图：标题 + 标签 + 日期（`updated_at`）+ 摘要（取 `summary`，为空时省略摘要项）；点开以**弹层（modal）**查看全文。
- 详情弹层底部显示**相关节点**（读 `knowledge_nodes` 中 `library_item_id` 等于本文 id 的节点），点击可跳转森林并自动选中该节点（经 `localStorage['cv_open_node']`）。森林侧栏的「前往图书馆查看」反向经 `localStorage['cv_open_item']` 自动打开文章。

### 10.4 `admin.html` + `admin.js`（后台，无房间设定）
- 后台不套用房间视觉与开关灯主题，**固定白底黑字的简单样式**，不使用 `data-light` 变量（§6.1 的灯光只作用于三个公开房间）。
- 未登录：登录表单（`supabase.auth.signInWithPassword`）。
- 已登录：管理面板 tab：
  1. **航行日志**：编辑 `profile`（空间编号/状态/属空间/正文）。
  2. **图书馆**：`library_items` 增删改 + 标签设置 + 摘要（`summary`）编辑。
  3. **森林**：节点/连线增删改 + 手动摆放节点（拖动画布中的节点，松手后把像素坐标换算为 0–1 归一化写入 `x/y`，并置 `pinned=true`；「取消固定」置 `pinned=false`，坐标忽略、恢复自动布局）。**节点表单**可设名称/简介/标签/关联文章；**标签管理**可增删标签并改颜色（节点同步变色）。**连线增删**：进入连线模式后，先点击节点 A、再点击节点 B——两点间无线则创建边、有线则删除该边；选中节点高亮并提示下一步。
  4. **提问箱**：审核；「发布并回答」/「设为私密」/「拒绝」；可见 `submitter_email`；回答为**纯文本 textarea**（非 Markdown，`maxlength=500` 并显示计数）。
  5. **通讯坐标**：`friend_links` 增删改 + 排序。
- 登录态：`getSession()` / `onAuthStateChange`；提供登出。
- Markdown 编辑器：航行日志/图书馆正文编辑采用「`textarea` + 实时预览」两栏（左编辑、右 `marked`+DOMPurify 预览），保持零依赖；工具栏提供「插入图片」按钮——选择本地图片上传到 Storage bucket `images`，取得 public URL 后插入 `![](url)` 到光标处。
- 后台不套用房间视觉设定，不对外展示入口；`admin.html` 的 URL 可被直接访问，登录态与 RLS 是唯一防线（见 §9），这在本项目安全模型内可接受。

**全站错误处理约定**：所有 Supabase 请求失败 / 断网场景统一经 `js/ui.js` 的 toast 提示——读取失败显示「数据加载失败，请稍后重试」并支持重试，写入失败显示「操作失败」；不静默吞错。

---

## 11. 部署与环境搭建（站主视角步骤）

### 11.1 Supabase（一次性）
1. 访问 supabase.com 注册（GitHub 登录即可），新建项目，选择就近区域。
2. 记录 Project Settings → API 里的 **Project URL** 与 **anon public key**。
3. SQL Editor 执行 `sql/schema.sql`。
4. 开启 Email Auth、创建管理员账号、插入 `admins`、配置 Site URL（§8.3）。

### 11.2 本地预览
- 打开 `js/config.js`，填入 Project URL 与 anon key。
- 用 VS Code + Live Server 打开 `index.html`（外壳）。项目使用 ES Modules 与同源 iframe，`file://` 下双击打开会被浏览器拦截，因此必须用 Live Server。

### 11.3 GitHub Pages
1. 将仓库推送到 GitHub（`main` 分支，文件在根目录）。
2. 仓库 Settings → Pages → Source 选 `Deploy from a branch` → 分支 `main`、目录 `/ (root)` → Save。
3. 等待构建完成，访问 `https://<user>.github.io/<repo>/`。
4. 项目页部署在子路径 `/<repo>/`：HTML 内所有本地资源（`css/`、`js/`、`assets/`、内容 iframe 的 `src`）一律用**相对路径**（如 `css/style.css`、`js/home.js`、`home.html`），不要写 `/css/...` 绝对路径；外壳路由使用查询参数 `?room=`（GitHub Pages 无需重写规则）；Supabase 的 Site URL 与 Redirect URL 也需包含 `/repo/` 子路径（见 §8.3）。

---

## 12. 实施路线图（供实现 agent 排期）

1. **阶段 0 环境**：`js/config.js`、Supabase 项目、GitHub 仓库就绪。
2. **阶段 1 骨架**：`css/style.css`（开灯/关灯两套变量）、共享层（`supabase.js`/`settings.js`/`ui.js`）、外壳 `index.html` + `js/shell.js`（路由/边栏/播放器/消息广播）+ 3 个内容页骨架（`home`/`forest`/`library`）+ 独立 `admin.html`。
3. **阶段 2 后端**：执行 `sql/schema.sql`、创建管理员、种子数据。
4. **阶段 3 公开页**：主房间（控制台/留言板/门/猫/生态物件）+ 森林 + 图书馆（可并行）。
5. **阶段 4 后台**：登录 + 管理面板五个 tab。
6. **阶段 5 文档收尾**：`README.md`（含 BGM 来源标注）+ 部署验证。

---

## 13. 验证清单（Definition of Done）

- [ ] 主房间渲染正确（"凸"字形布局），页面加载后直接显示完整主房间地图（无进场动效），小门厅保留在地图上的显示。
- [ ] 外壳边栏可快速切换房间与音乐/开关灯；内容访问 ≤2 次点击；`?room=` 路由刷新/前进后退保持当前房间。
- [ ] 移动端进入显示「移动端暂未建设，建议前往 pc 端访问」提示，不渲染内容；桌面端正常进入。
- [ ] 开关灯全局生效（外壳 + 三个公开内容页同步）、刷新后记忆、默认开灯；后台不参与、固定白底黑字。
- [ ] 音乐：播放/切歌正常，切房**自动续播零中断**（外壳常驻）；状态默认播放、刷新后从 `currentTime` 续播，但受浏览器自动播放限制，首次点击后才出声；唱片机收到广播仅同步显示、不回发（无消息回路）；**自动续播/自动切歌不惊扰猫**。
- [ ] 控制台：航行日志（空间编号/状态/属空间/正文）与通讯坐标正常展示。
- [ ] 留言板：已发布问答分页展示（每页 20 条，**不显示提问/回答日期**）；经 `submit_question()` 投递成功且状态 `pending`；蜜罐字段、前端频控与服务端限流生效；访客内容渲染已转义（无 XSS）。
- [ ] 森林：朴素平面图，画布平移/缩放/点击展开正常、**公开页节点不可拖动**；`pinned` 节点锁定在手动坐标（0–1 归一化，fcose `fixedNodeConstraint`）；节点颜色随标签颜色、侧栏显示简介/标签/关联文章并可跳转图书馆；猫组件在场、简介词固定且颜色随主题。
- [ ] 图书馆：`updated_at` 倒序、分页（每页 20 条）、标签检索、Markdown 渲染（含插图与代码块，经 DOMPurify 净化）、摘要展示（`summary`）正常；详情显示相关节点并可跳转森林；猫组件在场、简介词固定且颜色随主题。
- [ ] 后台：五个 tab 全流程可用，白底黑字不随灯光；**插图上传到 Storage `images` 成功、公开页正常显示**。
- [ ] 留言板分「查看留言 / 投递便签」两个页签，投递成功后回到查看页并刷新。
- [ ] 电脑桌可打开贪吃蛇小游戏（点「开始游戏」才开局；方向键/WASD 移动、空格暂停、撞墙/自撞结束、可重开；前十高分榜与本机最高分、入榜留昵称）。
- [ ] 未登录对内容表写操作被 RLS 拒绝；提交提问成功。
- [ ] GitHub Pages 可访问，控制台无 Supabase/CORS 报错；第三方库（supabase-js/cytoscape/fcose/marked/DOMPurify）全局 `<script>` 加载正常、无加载错误。
- [ ] 全仓库无 `service_role`、无硬编码密码/密匙；公开页不渲染邮箱与 `private` 提问。
- [ ] 猫猫台词与界面文案回避对访客的人称代词（访客互动选项除外）。
- [ ] 像素猫：随机转移/待机动作（含走路帧）/不主动靠近访客/开关灯与切歌受惊/炸毛彩蛋（优先级最高）正常。

---

## 14. 范围边界（明确不做）

- 不做服务端渲染 / 自建后端；动态能力全部由 Supabase 承担。
- 不做多用户社交系统；账号体系仅限管理员。
- 暂不做多语言（仅中文）；恢复双语 = 加回 `*_en` 字段 + `i18n.js`（扩展点）。
- 不实现支付、嵌套评论、实时聊天等（后续可扩展）。
- 不直接使用受版权保护的像素素材与音乐；背景音乐仅限原创或 CC0/CC-BY 授权音频。
- 插图统一经 Supabase Storage（public bucket `images`）托管、后台直接上传，不做本地文件上传与第三方图床。
- 暂不做移动端适配；移动端进入显示「移动端暂未建设，建议前往 pc 端访问」提示。
