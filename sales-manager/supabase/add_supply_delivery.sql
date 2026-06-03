-- 공급 원가 필드 (상품별 원가 항목)
create table if not exists supply_fields (
  id serial primary key,
  product_id integer references products(id) on delete cascade,
  field_name text not null,
  amount integer not null default 0,
  created_at timestamptz default now()
);
alter table supply_fields enable row level security;
create policy "allow all" on supply_fields for all using (true) with check (true);

-- 택배 내역
create table if not exists deliveries (
  id serial primary key,
  delivery_date date not null default current_date,
  count integer not null default 0,
  cost_per_item integer not null default 0,
  note text,
  created_at timestamptz default now()
);
alter table deliveries enable row level security;
create policy "allow all" on deliveries for all using (true) with check (true);
