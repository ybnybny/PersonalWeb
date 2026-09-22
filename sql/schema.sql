-- =====================================================================
-- 赛博串门（Cyber Visiting）数据库脚本
-- 在 Supabase SQL Editor 中一次性执行（可重复执行：含 on conflict / or replace）
-- 内容：建表 + RLS 策略 + 函数/触发器 + Storage bucket + 种子数据
-- 对应 PROJECT_SPEC.md §8
-- =====================================================================

-- 开启扩展（gen_random_uuid 所需）
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. 建表
-- ---------------------------------------------------------------------

-- 管理员表：与 Supabase Auth 用户关联
create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade
);

-- 航行日志（个人简介，单行，id 恒为 1）
create table if not exists public.profile (
  id int primary key default 1 check (id = 1),
  space_id text not null default '',      -- 空间编号，存展示用字符串，如 ybnybny (YBN)
  status text not null default '',        -- 当前状态
  affiliation text not null default '',   -- 属空间（科幻措辞，内容为现实归属信息）
  log_md text not null default '',        -- 航行日志正文（Markdown）
  updated_at timestamptz not null default now()
);

-- 图书馆（Markdown 档案馆：作品与笔记统一，用标签区分）
create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',       -- 列表摘要（后台编辑）
  content_md text not null default '',    -- Markdown 正文，可插图/链接
  tags text[] not null default '{}',      -- 标签，如 {"作品"} / {"笔记"}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 森林：知识图谱节点
create table if not exists public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  desc text not null default '',
  x float not null default 0 check (x between 0 and 1),  -- 归一化坐标 0–1（相对画布宽高，原点左上角）
  y float not null default 0 check (y between 0 and 1),
  pinned boolean not null default false,  -- true=使用手动坐标，公开页锁定位置
  size int not null default 30            -- 节点直径（px，默认 30），渲染时作为节点宽高
);

-- 森林：连线
create table if not exists public.knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  source uuid not null references public.knowledge_nodes(id) on delete cascade,
  target uuid not null references public.knowledge_nodes(id) on delete cascade,
  label text,
  check (source <> target)  -- 禁止自环
);

-- 提问箱
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(trim(content)) between 1 and 100),  -- 留言内容（必填，≤100 字）
  display_mode text not null default 'public'
    check (display_mode in ('public','private')),   -- 公开/不公开（二选一，默认公开）
  submitter_name text check (submitter_name is null or char_length(trim(submitter_name)) between 1 and 20),  -- 留言人（选填，≤20 字，留空 = 匿名）
  submitter_email text check (submitter_email is null or submitter_email ~ '^[^@]+@[^@]+[.][^@]+$'),  -- 邮箱（选填，仅后台可见）
  hp text,                         -- 蜜罐字段：正常留空，机器人填写则拒绝
  status text not null default 'pending'
    check (status in ('pending','published','rejected')),
  answer text check (answer is null or char_length(answer) <= 500),  -- 回答（纯文本，≤500 字）
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

-- 友链（通讯坐标）
create table if not exists public.friend_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  desc text not null default '',
  avatar_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. 启用 Row Level Security
-- ---------------------------------------------------------------------

alter table public.admins          enable row level security;
alter table public.profile         enable row level security;
alter table public.library_items   enable row level security;
alter table public.knowledge_nodes enable row level security;
alter table public.knowledge_edges enable row level security;
alter table public.questions       enable row level security;
alter table public.friend_links    enable row level security;

-- ---------------------------------------------------------------------
-- 3. 管理员判断函数（security definer，安全）
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 4. 公开可读策略：内容表
-- ---------------------------------------------------------------------

drop policy if exists "public read profile" on public.profile;
create policy "public read profile" on public.profile
  for select using (true);
drop policy if exists "public read library" on public.library_items;
create policy "public read library" on public.library_items
  for select using (true);
drop policy if exists "public read nodes" on public.knowledge_nodes;
create policy "public read nodes" on public.knowledge_nodes
  for select using (true);
drop policy if exists "public read edges" on public.knowledge_edges;
create policy "public read edges" on public.knowledge_edges
  for select using (true);
drop policy if exists "public read friend_links" on public.friend_links;
create policy "public read friend_links" on public.friend_links
  for select using (true);

-- ---------------------------------------------------------------------
-- 5. 提问箱：公开只读（经函数，不含邮箱）
-- ---------------------------------------------------------------------

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

create or replace function public.get_published_questions_count()
returns bigint
language sql stable security definer
set search_path = public
as $$
  select count(*) from public.questions
  where status = 'published' and display_mode = 'public';
$$;

-- ---------------------------------------------------------------------
-- 6. 提问箱：管理员读取全部（含 pending/private/邮箱）
-- ---------------------------------------------------------------------

drop policy if exists "admin select questions" on public.questions;
create policy "admin select questions" on public.questions
  for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- 7. 提问箱：公开提交（security definer，统一收口）
-- ---------------------------------------------------------------------

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

-- 插入前校验：蜜罐、限流、强制待审核、归一化、防伪造时间戳
create or replace function public.questions_before_insert()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.hp, '') <> '' then
    raise exception 'spam rejected';
  end if;
  -- 简单全局限流：60 秒内已新增 5 条则拒绝下一条
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

drop trigger if exists trg_questions_before_insert on public.questions;
create trigger trg_questions_before_insert
  before insert on public.questions
  for each row execute function public.questions_before_insert();

-- ---------------------------------------------------------------------
-- 8. 仅管理员可写：内容表增删改
-- ---------------------------------------------------------------------

drop policy if exists "admin all profile" on public.profile;
create policy "admin all profile" on public.profile
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin all library" on public.library_items;
create policy "admin all library" on public.library_items
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin all nodes" on public.knowledge_nodes;
create policy "admin all nodes" on public.knowledge_nodes
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin all edges" on public.knowledge_edges;
create policy "admin all edges" on public.knowledge_edges
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin all friend_links" on public.friend_links;
create policy "admin all friend_links" on public.friend_links
  for all using (public.is_admin()) with check (public.is_admin());

-- 仅管理员可写：提问箱审核/回答/隐藏（更新）
drop policy if exists "admin update questions" on public.questions;
create policy "admin update questions" on public.questions
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete questions" on public.questions;
create policy "admin delete questions" on public.questions
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- 9. 更新时间戳
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profile_updated_at on public.profile;
create trigger trg_profile_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

drop trigger if exists trg_library_updated_at on public.library_items;
create trigger trg_library_updated_at
  before update on public.library_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 10. 插图存储：public bucket images
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects
  for select using (bucket_id = 'images');

drop policy if exists "admin insert images" on storage.objects;
create policy "admin insert images" on storage.objects
  for insert with check (bucket_id = 'images' and public.is_admin());

drop policy if exists "admin update images" on storage.objects;
create policy "admin update images" on storage.objects
  for update using (bucket_id = 'images' and public.is_admin())
  with check (bucket_id = 'images' and public.is_admin());

drop policy if exists "admin delete images" on storage.objects;
create policy "admin delete images" on storage.objects
  for delete using (bucket_id = 'images' and public.is_admin());

-- ---------------------------------------------------------------------
-- 11. 种子数据（可选，可重复执行：固定 id / on conflict do nothing）
-- ---------------------------------------------------------------------

-- 航行日志
insert into public.profile (id, space_id, status, affiliation, log_md)
values (
  1,
  'ybnybny (YBN)',
  '计算机类大一生',
  '北京科技大学（USTB）',
  '## 航行日志\n\n这里是小屋的航行日志。\n\n记录一些正在做的事、学的东西。\n\n> 正文在后台「航行日志」页编辑。'
)
on conflict (id) do nothing;

-- 图书馆示例
insert into public.library_items (id, title, summary, content_md, tags)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '示例作品：第一个网页',
    '用原生 HTML/CSS/JS 搭的一个小页面。',
    '## 第一个网页\n\n这是一个 **示例作品**。\n\n- 学了标签\n- 学了样式\n- 学了交互\n\n![示例图](https://example.com/example.png)',
    array['作品']
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '示例笔记：Markdown 入门',
    '关于 Markdown 语法的简单笔记。',
    '## Markdown 入门\n\n### 标题\n\n`#` 表示标题。\n\n### 列表\n\n- 无序列表\n- 第二项\n',
    array['笔记']
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    '示例笔记：像素画练习',
    '用 CSS box-shadow 画小像素图的记录。',
    '## 像素画练习\n\n用 `box-shadow` 一格一格画。',
    array['笔记']
  )
on conflict (id) do nothing;

-- 森林示例节点
insert into public.knowledge_nodes (id, label, desc, x, y, pinned, size)
values
  ('00000000-0000-4000-8000-000000000201', '数据结构', '森林借用「数据结构」概念。', 0.5, 0.4, true, 44),
  ('00000000-0000-4000-8000-000000000202', '图', '节点与边的抽象结构。', 0.32, 0.6, true, 34),
  ('00000000-0000-4000-8000-000000000203', '树', '没有环的连通图。', 0.68, 0.6, true, 34),
  ('00000000-0000-4000-8000-000000000204', '前端', 'HTML / CSS / JavaScript。', 0.35, 0.25, false, 30),
  ('00000000-0000-4000-8000-000000000205', 'Supabase', 'Postgres + Auth + RLS。', 0.65, 0.25, false, 30)
on conflict (id) do nothing;

-- 森林示例连线
insert into public.knowledge_edges (id, source, target, label)
values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '包含'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000203', '包含'),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000205', '使用')
on conflict (id) do nothing;

-- 友链占位
insert into public.friend_links (id, name, url, desc, sort_order)
values
  ('00000000-0000-4000-8000-000000000401', '示例友链', 'https://example.com', '替换为真实友链。', 0)
on conflict (id) do nothing;
