-- 각 채널별 주문서 업로드를 위한 sales 테이블 필드 추가
alter table sales add column if not exists order_number text;
alter table sales add column if not exists ordered_at timestamptz;
alter table sales add column if not exists buyer_name text;
alter table sales add column if not exists buyer_phone text;
alter table sales add column if not exists buyer_address text;
alter table sales add column if not exists receiver_name text;
alter table sales add column if not exists receiver_phone text;
alter table sales add column if not exists receiver_phone2 text;
alter table sales add column if not exists receiver_address text;
alter table sales add column if not exists receiver_address_detail text;
alter table sales add column if not exists receiver_zip text;
alter table sales add column if not exists item_name text;
alter table sales add column if not exists item_detail text;
alter table sales add column if not exists item_qty integer;
alter table sales add column if not exists delivery_msg text;

-- 채널 추가 (없으면)
insert into channels (name) values ('자사몰') on conflict (name) do nothing;
insert into channels (name) values ('쿠팡') on conflict (name) do nothing;
insert into channels (name) values ('오너클랜') on conflict (name) do nothing;
