# 赛博串门（Cyber Visiting）

一间飘在数据海的无名小屋。没有名字。灯亮着。像素猫一直在这里。

- **纯静态**：HTML/CSS/JS + CDN，零构建、零 npm，克隆即开、推送即上线。
- **后端**：Supabase（Postgres + Auth + Row Level Security，免费层）。
- **托管**：GitHub Pages。

## 一、首次部署（按顺序做）

### 1. 准备代码

把本项目代码放到本地（`e:\PersonalWeb\`），并推送到一个 GitHub 仓库（文件在根目录、`main` 分支）。

### 2. 创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com) 注册（GitHub 登录即可），新建项目，选就近区域。
2. 打开 **Project Settings → API**，记下 **Project URL** 和 **anon public key**。
3. 打开 **SQL Editor**，把 `sql/schema.sql` 的**全部内容**粘贴进去执行（可重复执行）。
4. 打开 **Authentication → Providers → Email**：开启 Email，并关闭 **Confirm email**；同时在 **Authentication → Settings** 里关闭 **Allow new users to sign up**（禁止公开注册）。
5. 打开 **Authentication → Users → Add user**，创建一个管理员账号（邮箱 + 密码）。
6. 回到 **SQL Editor** 执行下面这句，把 `<该用户的 UUID>` 换成上一步用户列表里看到的 UUID：

   ```sql
   insert into public.admins (id) values ('<该用户的 UUID>');
   ```

7. 打开 **Authentication → URL Configuration**：Site URL 设为最终网址（如 `https://<用户名>.github.io/<仓库名>/`），并在 **Redirect URLs** 白名单里加入该网址；本地预览地址（如 `http://127.0.0.1:5500/`）也一并加入。
8. 配置插图存储（Storage，后台「插入图片」要用）：
   1. 左侧 **Storage** → **New bucket** → 名称填 `images` → 打开 **Public bucket** 开关 → 创建。
   2. 进入 **Storage → Policies**，找到 `images` 桶 → 点 **New policy** → 选 **Create a policy from scratch**。
   3. 按下面填：Policy name 填 `admin write images`；Allowed operation 勾 **INSERT / UPDATE / DELETE**；Target roles 选 **authenticated**；USING 与 WITH CHECK 都填 `bucket_id = 'images'`。
   4. 保存。（公开读取由「Public bucket」直接提供，无需再建读策略。）

### 3. 填写配置

编辑 `js/config.js`，把两个占位值替换为你的 Project URL 与 anon public key：

```js
export const SUPABASE_URL = 'https://你的项目.supabase.co';
export const SUPABASE_ANON_KEY = '你的-anon-key';
```

> ⚠️ 只填这两个公开值。**永远不要把 `service_role` key 放进任何前端文件。**

### 4. 本地预览

用 VS Code 安装 **Live Server** 插件，右键 `index.html` → **Open with Live Server**。

> 项目使用 ES Modules 与同源 iframe，**双击 `index.html`（`file://`）会被浏览器拦截**，必须用 Live Server。

### 5. 发布到 GitHub Pages

1. 把代码推送到 GitHub 仓库（`main` 分支）。
2. 仓库 **Settings → Pages → Source** 选 `Deploy from a branch`，分支 `main`、目录 `/(root)` → Save。
3. 等待构建完成，访问 `https://<用户名>.github.io/<仓库名>/`。

## 二、日常使用（后台）

浏览器直接访问 `<你的网址>/admin.html`，用管理员邮箱登录，五个页签：

| 页签 | 用途 |
|---|---|
| 航行日志 | 编辑个人简介（空间编号/状态/属空间/正文，正文支持 Markdown） |
| 图书馆 | 作品与笔记的增删改、打标签、写摘要 |
| 森林 | 知识图谱节点/连线增删改；**拖动节点**即固定位置（松手自动保存坐标） |
| 提问箱 | 审核访客留言：发布并回答 / 设为私密 / 拒绝 |
| 通讯坐标 | 友链增删改与排序 |

> Markdown 编辑器里点「插入图片」会把图片上传到 Supabase Storage，自动插入图片链接。

## 三、背景音乐与版权

- 背景音乐放在 `assets/audio/bgm-1.mp3`、`assets/audio/bgm-2.mp3`，**统一 mp3**（兼容 Safari）。
- 已放入两首背景音乐（请确认授权为 **原创或 CC0/CC-BY**，来源见下表）：

  | 文件 | 曲名 / 作者 | 来源 / 授权 |
  |---|---|---|
  | `assets/audio/bgm-1.mp3` | Elf Beat — Realtime Project | Unminus（免费音乐库，建议到原站确认授权条款） |
  | `assets/audio/bgm-2.mp3` | Sunset — Coldise | Unminus（免费音乐库，建议到原站确认授权条款） |

- **红线**：不得搬运受版权保护的音乐；像素素材不使用任何受版权保护的商业游戏素材。

## 四、目录结构

```
index.html      常驻外壳（边栏 + 音乐播放器 + 内容 iframe）
home.html       主房间
forest.html     森林（知识图谱）
library.html    图书馆（Markdown 档案馆）
admin.html      后台（独立页）
css/style.css   全局样式（开灯/关灯两套主题）
js/             shell / npc / home / forest / library / admin 等脚本
sql/schema.sql  建表 + RLS + 种子数据（Storage 在 Dashboard 手动配置）
assets/audio/   背景音乐
docs/PROJECT_SPEC.md   项目规格（唯一权威说明书）
```

## 五、常见问题

- **页面空白 / 控制台报错**：先确认 `js/config.js` 已填写、`sql/schema.sql` 已执行、Live Server 而非 `file://` 打开。
- **留言投递失败**：检查 Supabase 里 `submit_question` 是否已授权给 `anon`（`schema.sql` 已包含）。
- **音乐没声音**：浏览器自动播放策略限制，首次点击页面任意处后才会出声（这是正常现象）。
- **后台登录失败**：确认已关闭 Confirm email、已把该用户 UUID 写入 `admins` 表。

更多细节见 `docs/PROJECT_SPEC.md`。
