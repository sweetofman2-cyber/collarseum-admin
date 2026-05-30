-- 구매 채널
create table channels (
  id serial primary key,
  name text not null unique,
  created_at timestamptz default now()
);

-- 상품
create table products (
  id serial primary key,
  name text not null,
  price integer not null default 0,
  created_at timestamptz default now()
);

-- 회원
create table members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  created_at timestamptz default now()
);

-- 판매 내역
create table sales (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  product_id integer references products(id) on delete set null,
  channel_id integer references channels(id) on delete set null,
  quantity integer not null default 1,
  total_price integer not null default 0,
  note text,
  sold_at timestamptz default now()
);

-- 기본 채널 데이터
insert into channels (name) values
  ('인스타그램'),
  ('네이버 스마트스토어'),
  ('카카오톡'),
  ('오프라인'),
  ('기타');

-- 기본 상품 데이터
insert into products (name, price) values
  ('상품 A', 10000),
  ('상품 B', 25000),
  ('상품 C', 50000);

-- RLS 정책 (모든 인증된 요청 허용 — 필요시 강화)
alter table members enable row level security;
alter table sales enable row level security;
alter table channels enable row level security;
alter table products enable row level security;

create policy "allow all" on members for all using (true) with check (true);
create policy "allow all" on sales for all using (true) with check (true);
create policy "allow all" on channels for all using (true) with check (true);
create policy "allow all" on products for all using (true) with check (true);
