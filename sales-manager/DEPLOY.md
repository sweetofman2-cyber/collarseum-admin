# 배포 가이드

## 1. Supabase 설정

1. https://supabase.com 에서 새 프로젝트 생성
2. **SQL Editor** → `supabase/schema.sql` 내용을 붙여넣고 실행
3. **Project Settings → API** 에서 복사:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. 로컬 개발

```bash
cd sales-manager
cp .env.local.example .env.local
# .env.local 에 Supabase URL과 Key 입력

npm install
npm run dev
# http://localhost:3000 접속
```

## 3. Vercel 배포

```bash
npm install -g vercel
vercel login
vercel
```

또는 GitHub에 push 후 https://vercel.com 에서 Import:

1. GitHub 저장소 연결
2. **Environment Variables** 에서 아래 두 값 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy 클릭

## 페이지 구성

| 경로 | 설명 |
|------|------|
| `/` | 대시보드 (통계 + 최근 판매) |
| `/members` | 회원 등록 / 수정 / 삭제 |
| `/sales` | 판매 입력 (회원 검색, 채널, 상품) |
| `/history` | 판매 내역 조회 / 필터 / 삭제 |
| `/settings` | 상품 및 채널 추가·수정·삭제 |
