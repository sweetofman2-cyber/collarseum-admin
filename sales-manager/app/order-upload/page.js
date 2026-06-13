'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

// ──────────────────────────────────────────────
// 채널별 파싱 함수
// ──────────────────────────────────────────────
function parseJasaMol(raw) {
  // 자사몰 CSV: 주문번호 기준 그룹화 (같은 주문번호 → 상품 합치기)
  const groups = {}
  for (const row of raw) {
    const orderNo = String(row['주문번호'] || '').trim()
    if (!orderNo) continue
    if (!groups[orderNo]) {
      groups[orderNo] = {
        order_number: orderNo,
        ordered_at: row['발주일'] ? new Date(row['발주일']) : null,
        receiver_name: String(row['수령인'] || '').trim(),
        receiver_phone: String(row['수령인 휴대전화'] || '').trim(),
        receiver_address: String(row['수령인 주소'] || '').trim(),
        receiver_address_detail: String(row['수령인 상세 주소'] || '').trim(),
        receiver_zip: String(row['수령인 우편번호'] || '').trim(),
        delivery_msg: String(row['배송메시지'] || '').trim(),
        total_price: parseFloat(row['총 결제금액'] || 0) || 0,
        items: [],
      }
    }
    groups[orderNo].items.push(String(row['주문상품명(옵션포함)'] || row['주문상품명'] || '').trim())
  }
  return Object.values(groups).map(g => ({
    ...g,
    buyer_name: '',
    buyer_phone: '',
    buyer_address: '',
    receiver_phone2: '',
    item_name: '카라세움',
    item_detail: g.items.join(' / '),
    item_qty: g.items.length,
    note: '',
  }))
}

function parseCoupang(raw) {
  // 쿠팡: 묶음배송번호 기준 그룹화
  const groups = {}
  for (const row of raw) {
    const bundleNo = String(row['묶음배송번호'] || row['주문번호'] || '').trim()
    if (!bundleNo) continue
    if (!groups[bundleNo]) {
      const addrFull = String(row['수취인 주소'] || '').trim()
      groups[bundleNo] = {
        order_number: String(row['주문번호'] || '').trim(),
        ordered_at: row['주문일'] ? new Date(row['주문일']) : null,
        buyer_name: String(row['구매자'] || '').trim(),
        buyer_phone: String(row['구매자전화번호'] || '').trim(),
        buyer_address: '',
        receiver_name: String(row['수취인이름'] || '').trim(),
        receiver_phone: String(row['수취인전화번호'] || '').trim(),
        receiver_phone2: '',
        receiver_address: addrFull,
        receiver_address_detail: '',
        receiver_zip: String(row['우편번호'] || '').trim(),
        delivery_msg: String(row['배송메세지'] || '').trim(),
        total_price: parseFloat(row['결제액'] || 0) || 0,
        items: [],
      }
    }
    const productName = String(row['등록상품명'] || '').trim()
    const optionName = String(row['등록옵션명'] || '').trim()
    groups[bundleNo].items.push(optionName ? `${productName} (${optionName})` : productName)
  }
  return Object.values(groups).map(g => ({
    ...g,
    item_name: '카라세움',
    item_detail: g.items.join(' / '),
    item_qty: g.items.length,
    note: '',
  }))
}

function parseOwnerClan(raw) {
  // 주문번호 기준 그룹화 (동일 주문번호 → 상품 합치기)
  const groups = {}
  for (const row of raw) {
    const orderNo = String(row['주문번호'] || '').trim()
    if (!orderNo) continue
    const dateVal = row['일자']
    let ordered_at = null
    if (dateVal) {
      const s = String(dateVal).replace(/\//g, '-')
      ordered_at = new Date(s)
    }
    if (!groups[orderNo]) {
      groups[orderNo] = {
        order_number: orderNo,
        ordered_at,
        buyer_name: String(row['보내는사람'] || '').trim(),
        buyer_phone: String(row['보내는사람 핸드폰'] || row['보내는사람 연락처'] || '').trim(),
        buyer_address: String(row['반품주소'] || '').trim(),
        receiver_name: String(row['받는사람'] || '').trim().replace(/\([^)]*\)/, '').trim(),
        receiver_phone: String(row['받는사람 핸드폰'] || '').trim(),
        receiver_phone2: String(row['받는사람 전화번호'] || '').trim(),
        receiver_address: String(row['주소'] || '').trim(),
        receiver_address_detail: '',
        receiver_zip: String(row['우편번호'] || '').trim(),
        delivery_msg: String(row['배송메세지'] || '').trim(),
        total_price: 0,
        items: [],
        totalQty: 0,
      }
    }
    const productName = String(row['상품명'] || '').trim()
    const option = String(row['옵션'] || '').trim()
    const qty = parseInt(row['수량'] || 1) || 1
    const itemLabel = option ? `${productName} (${option})` : productName
    groups[orderNo].items.push(itemLabel)
    groups[orderNo].totalQty += qty
    groups[orderNo].total_price += parseFloat(row['오너클랜 정산예정금액'] || 0) || 0
  }
  return Object.values(groups).map(g => ({
    ...g,
    item_name: '카라세움',
    item_detail: g.items.join(' / '),
    item_qty: g.totalQty,
    note: '',
  }))
}

// 주소 분할: 시/도 구/군까지 + 나머지
function splitAddress(full) {
  if (!full) return { main: '', detail: '' }
  const parts = full.trim().split(/\s+/)
  // 시/도 + 시/군/구 + 읍/면/동/로/길 (최소 3토큰을 main으로)
  const mainCount = Math.min(Math.max(parts.length - 2, 3), parts.length)
  return {
    main: parts.slice(0, mainCount).join(' '),
    detail: parts.slice(mainCount).join(' '),
  }
}

// 엑셀 다운로드 유틸
function downloadExcel(rows, filename) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, filename)
}

const CHANNELS = ['자사몰', '쿠팡', '오너클랜']

// ──────────────────────────────────────────────
export default function OrderUploadPage() {
  const [channel, setChannel] = useState('자사몰')
  const [preview, setPreview] = useState(null) // parsed rows before save
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  // 저장된 데이터
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  // 검색/필터
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterChannel, setFilterChannel] = useState('')

  // 채널 id 맵
  const [channelMap, setChannelMap] = useState({})

  useEffect(() => {
    supabase.from('channels').select('*').then(({ data }) => {
      if (data) {
        const m = {}
        data.forEach(c => { m[c.name] = c.id })
        setChannelMap(m)
      }
    })
  }, [])

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true)
    let q = supabase
      .from('sales')
      .select('*, channels(name)')
      .not('order_number', 'is', null)
      .order('ordered_at', { ascending: false })
      .limit(10000)

    if (filterChannel) {
      const cid = channelMap[filterChannel]
      if (cid) q = q.eq('channel_id', cid)
    }
    if (dateFrom) q = q.gte('ordered_at', dateFrom)
    if (dateTo) q = q.lte('ordered_at', dateTo + 'T23:59:59')

    const { data, error } = await q
    setLoadingOrders(false)
    if (error) { toast.error('조회 실패: ' + error.message); return }
    setOrders(data || [])
  }, [channelMap, filterChannel, dateFrom, dateTo])

  useEffect(() => {
    if (Object.keys(channelMap).length > 0) loadOrders()
  }, [channelMap, loadOrders])

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' })
        let parsed = []
        if (channel === '자사몰') parsed = parseJasaMol(raw)
        else if (channel === '쿠팡') parsed = parseCoupang(raw)
        else if (channel === '오너클랜') parsed = parseOwnerClan(raw)
        setPreview(parsed)
        toast.success(`${parsed.length}건 파싱 완료. 내용 확인 후 저장하세요.`)
      } catch (err) {
        toast.error('파일 파싱 오류: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function handleSave() {
    if (!preview?.length) return
    const cid = channelMap[channel]
    if (!cid) { toast.error(`채널 "${channel}"을 DB에서 찾을 수 없습니다. 마이그레이션을 실행하세요.`); return }

    setSaving(true)
    const inserts = preview.map(r => ({
      channel_id: cid,
      order_number: r.order_number || null,
      ordered_at: r.ordered_at ? r.ordered_at.toISOString() : null,
      buyer_name: r.buyer_name || null,
      buyer_phone: r.buyer_phone || null,
      buyer_address: r.buyer_address || null,
      receiver_name: r.receiver_name || null,
      receiver_phone: r.receiver_phone || null,
      receiver_phone2: r.receiver_phone2 || null,
      receiver_address: r.receiver_address || null,
      receiver_address_detail: r.receiver_address_detail || null,
      receiver_zip: r.receiver_zip || null,
      item_name: r.item_name || null,
      item_detail: r.item_detail || null,
      item_qty: r.item_qty || 1,
      delivery_msg: r.delivery_msg || null,
      total_price: Math.round(r.total_price || 0),
      note: r.note || null,
      quantity: r.item_qty || 1,
    }))

    const { error } = await supabase.from('sales').insert(inserts)
    setSaving(false)
    if (error) { toast.error('저장 실패: ' + error.message); return }
    toast.success(`${inserts.length}건 저장 완료!`)
    setPreview(null)
    loadOrders()
  }

  // 검색 필터 적용
  const filtered = orders.filter(o => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (o.receiver_name || '').toLowerCase().includes(s) ||
      (o.receiver_phone || '').includes(s) ||
      (o.order_number || '').includes(s) ||
      (o.item_detail || '').toLowerCase().includes(s)
    )
  })

  // 상단 테이블 엑셀 다운로드
  function downloadOrderTable() {
    const rows = filtered.map((o, i) => ({
      번호: i + 1,
      이름: o.receiver_name || '',
      휴대폰번호: o.receiver_phone || '',
      채널: o.channels?.name || '',
      구매제품: o.item_detail || '',
      주문일: o.ordered_at ? o.ordered_at.slice(0, 10) : '',
      비고: o.note || '',
      주문번호: o.order_number || '',
    }))
    downloadExcel(rows, `주문목록_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // 하단 테이블 엑셀 다운로드
  function downloadShippingTable() {
    const rows = filtered.map(o => {
      const receiverAddrFull = [o.receiver_address, o.receiver_address_detail].filter(Boolean).join(' ')
      const receiverAddrSplit = splitAddress(receiverAddrFull)
      const buyerAddrSplit = splitAddress(o.buyer_address || '')
      return {
        보내는분성명: o.buyer_name || '',
        '보내는분주소(전체)': o.buyer_address || '',
        '보내는분주소(분할주소1)': buyerAddrSplit.main,
        '보내는분주소(분할주소2)': buyerAddrSplit.detail,
        보내는분전화번호: o.buyer_phone || '',
        받는분성명: o.receiver_name || '',
        받는분전화번호: o.receiver_phone || '',
        받는분기타연락처: o.receiver_phone2 || '',
        '받는분주소(전체)': receiverAddrFull,
        '받는분주소(분할주소1)': receiverAddrSplit.main,
        '받는분주소(분할주소2)': receiverAddrSplit.detail,
        품목명: o.item_name || '',
        내품명: o.item_detail || '',
        내품수량: o.item_qty || 1,
        배송메세지1: o.delivery_msg || '',
      }
    })
    downloadExcel(rows, `배송목록_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">각 채널별 주문서</h1>

      {/* 업로드 카드 */}
      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-3">채널 선택 및 파일 업로드</h2>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={channel}
            onChange={e => { setChannel(e.target.value); setPreview(null) }}
          >
            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={() => fileRef.current?.click()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition"
          >
            {channel} 파일 선택
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFile}
          />
          <span className="text-xs text-gray-400">
            {channel === '자사몰' && '자사몰 CSV 또는 Excel 파일'}
            {channel === '쿠팡' && '쿠팡 주문서 Excel (.xlsx)'}
            {channel === '오너클랜' && '오너클랜 주문서 Excel (.xlsx)'}
          </span>
        </div>

        {preview && (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200 mb-3 max-h-64 overflow-y-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">주문번호</th>
                    <th className="px-3 py-2 text-left">수령인</th>
                    <th className="px-3 py-2 text-left">전화번호</th>
                    <th className="px-3 py-2 text-left">주문일</th>
                    <th className="px-3 py-2 text-left">구매제품</th>
                    <th className="px-3 py-2 text-left">주소</th>
                    <th className="px-3 py-2 text-left">배송메시지</th>
                    <th className="px-3 py-2 text-right">금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500">{r.order_number}</td>
                      <td className="px-3 py-2 font-medium">{r.receiver_name}</td>
                      <td className="px-3 py-2">{r.receiver_phone}</td>
                      <td className="px-3 py-2 text-gray-500">
                        {r.ordered_at ? r.ordered_at.toISOString().slice(0,10) : '-'}
                      </td>
                      <td className="px-3 py-2">{r.item_detail}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{r.receiver_address}</td>
                      <td className="px-3 py-2 text-gray-500">{r.delivery_msg || '-'}</td>
                      <td className="px-3 py-2 text-right">{r.total_price ? r.total_price.toLocaleString() + '원' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">총 <strong>{preview.length}건</strong> 미리보기</span>
              <div className="flex gap-2">
                <button onClick={() => setPreview(null)} className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">취소</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {saving ? '저장 중...' : `${preview.length}건 저장`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 검색/필터 */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">검색</label>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="이름, 전화번호, 주문번호, 상품명"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">채널</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={filterChannel}
              onChange={e => setFilterChannel(e.target.value)}
            >
              <option value="">전체</option>
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">주문일 시작</label>
            <input
              type="date"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">주문일 종료</label>
            <input
              type="date"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>
          <button
            onClick={loadOrders}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            조회
          </button>
          <button
            onClick={() => { setSearch(''); setFilterChannel(''); setDateFrom(''); setDateTo('') }}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
          >
            초기화
          </button>
        </div>
      </div>

      {/* ─── 상단 테이블: 주문 목록 ─── */}
      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-700">
            주문 목록
            <span className="ml-2 text-sm font-normal text-gray-400">{filtered.length}건</span>
          </h2>
          <button
            onClick={downloadOrderTable}
            disabled={!filtered.length}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-40 transition"
          >
            엑셀 다운로드
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-80 overflow-y-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
              <tr>
                <th className="px-3 py-2 text-center w-12">번호</th>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">휴대폰번호</th>
                <th className="px-3 py-2 text-left">채널</th>
                <th className="px-3 py-2 text-left">구매제품</th>
                <th className="px-3 py-2 text-left">주문일</th>
                <th className="px-3 py-2 text-left">비고</th>
                <th className="px-3 py-2 text-left">주문번호</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingOrders ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">로딩 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-300">데이터가 없습니다</td></tr>
              ) : filtered.map((o, i) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-center text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{o.receiver_name || '-'}</td>
                  <td className="px-3 py-2">{o.receiver_phone || '-'}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {o.channels?.name || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700 max-w-xs truncate">{o.item_detail || '-'}</td>
                  <td className="px-3 py-2 text-gray-500">{o.ordered_at ? o.ordered_at.slice(0,10) : '-'}</td>
                  <td className="px-3 py-2 text-gray-400">{o.note || '-'}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{o.order_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 하단 테이블: 배송 라벨 ─── */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-700">
            배송 정보
            <span className="ml-2 text-sm font-normal text-gray-400">{filtered.length}건</span>
          </h2>
          <button
            onClick={downloadShippingTable}
            disabled={!filtered.length}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-40 transition"
          >
            엑셀 다운로드
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-80 overflow-y-auto">
          <table className="w-full text-xs min-w-[1600px]">
            <thead className="bg-gray-50 text-gray-500 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left whitespace-nowrap">보내는분성명</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">보내는분주소(전체)</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">보내는분주소(분할주소1)</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">보내는분주소(분할주소2)</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">보내는분전화번호</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">받는분성명</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">받는분전화번호</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">받는분기타연락처</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">받는분주소(전체)</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">받는분주소(분할주소1)</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">받는분주소(분할주소2)</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">품목명</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">내품명</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">내품수량</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">배송메세지1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingOrders ? (
                <tr><td colSpan={15} className="text-center py-8 text-gray-400">로딩 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={15} className="text-center py-8 text-gray-300">데이터가 없습니다</td></tr>
              ) : filtered.map(o => {
                const receiverAddrFull = [o.receiver_address, o.receiver_address_detail].filter(Boolean).join(' ')
                const receiverAddrSplit = splitAddress(receiverAddrFull)
                const buyerAddrSplit = splitAddress(o.buyer_address || '')
                return (
                  <tr key={o.id + '_ship'} className="hover:bg-gray-50">
                    <td className="px-2 py-2">{o.buyer_name || '-'}</td>
                    <td className="px-2 py-2 max-w-[140px] truncate text-gray-500">{o.buyer_address || '-'}</td>
                    <td className="px-2 py-2 max-w-[140px] truncate text-gray-500">{buyerAddrSplit.main || '-'}</td>
                    <td className="px-2 py-2 max-w-[100px] truncate text-gray-500">{buyerAddrSplit.detail || '-'}</td>
                    <td className="px-2 py-2">{o.buyer_phone || '-'}</td>
                    <td className="px-2 py-2 font-medium">{o.receiver_name || '-'}</td>
                    <td className="px-2 py-2">{o.receiver_phone || '-'}</td>
                    <td className="px-2 py-2">{o.receiver_phone2 || '-'}</td>
                    <td className="px-2 py-2 max-w-[160px] truncate text-gray-500">{receiverAddrFull || '-'}</td>
                    <td className="px-2 py-2 max-w-[140px] truncate text-gray-500">{receiverAddrSplit.main || '-'}</td>
                    <td className="px-2 py-2 max-w-[100px] truncate text-gray-500">{receiverAddrSplit.detail || '-'}</td>
                    <td className="px-2 py-2">{o.item_name || '-'}</td>
                    <td className="px-2 py-2 max-w-[180px] truncate">{o.item_detail || '-'}</td>
                    <td className="px-2 py-2 text-center">{o.item_qty || 1}</td>
                    <td className="px-2 py-2 text-gray-500">{o.delivery_msg || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
