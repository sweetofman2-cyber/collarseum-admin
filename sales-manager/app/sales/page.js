'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const emptyForm = { member_id: '', phone: '', product_id: '', channel_id: '', quantity: 1, note: '' }

// 비고 문자열에서 상품+수량 목록 파싱
// 예: "레전드실버2 타임1" → [{product, qty}, ...]
function parseBigo(bigo, products) {
  if (!bigo) return []
  const normalized = products.map(p => ({
    ...p,
    key: p.name.replace(/\s/g, '').toLowerCase(),
  })).sort((a, b) => b.key.length - a.key.length) // 긴 이름 먼저 매칭

  const results = []
  const tokens = String(bigo).trim().split(/\s+/)

  for (const token of tokens) {
    // 토큰 끝 숫자 분리: "타임1" → base="타임", qty=1
    const numMatch = token.match(/^(.*?)(\d+)$/)
    const base = (numMatch ? numMatch[1] : token).toLowerCase()
    const qty = numMatch ? parseInt(numMatch[2]) : 1

    if (!base) continue

    // 1. 정확히 일치
    let match = normalized.find(p => p.key === base)
    // 2. 앞부분 일치 (예: "타임" → "타임실버")
    if (!match) match = normalized.find(p => p.key.startsWith(base))
    // 3. 포함 일치 (예: "레전드블랙" 오타 대비)
    if (!match) match = normalized.find(p => p.key.includes(base))

    if (match) results.push({ product: match, qty })
  }
  return results
}

// 채널 매칭 (부분 문자열)
function matchChannel(cellValue, channels) {
  if (!cellValue) return null
  const v = String(cellValue).trim()
  return channels.find(c => c.name.includes(v) || v.includes(c.name.replace(/\s/g, ''))) || null
}

export default function SalesInput() {
  const [form, setForm] = useState(emptyForm)
  const [products, setProducts] = useState([])
  const [channels, setChannels] = useState([])
  const [members, setMembers] = useState([])
  const [memberSuggestions, setMemberSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)

  // 엑셀 일괄 입력
  const [importRows, setImportRows] = useState(null) // 파싱된 미리보기 행
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: c }, { data: m }] = await Promise.all([
        supabase.from('products').select('*').order('id'),
        supabase.from('channels').select('*').order('id'),
        supabase.from('members').select('*').order('name'),
      ])
      setProducts(p || [])
      setChannels(c || [])
      setMembers(m || [])
    }
    load()
  }, [])

  function handlePhoneChange(e) {
    const val = e.target.value
    setForm(p => ({ ...p, phone: val, member_id: '' }))
    setSelectedMember(null)
    if (val.length >= 2) {
      setMemberSuggestions(members.filter(m => m.phone.includes(val) || m.name.includes(val)))
    } else {
      setMemberSuggestions([])
    }
  }

  function selectMember(m) {
    setSelectedMember(m)
    setForm(p => ({ ...p, member_id: m.id, phone: m.phone }))
    setMemberSuggestions([])
  }

  function handleProductChange(e) {
    const id = e.target.value
    setForm(p => ({ ...p, product_id: id }))
    setSelectedProduct(products.find(p => p.id == id) || null)
  }

  const totalPrice = selectedProduct ? selectedProduct.price * Number(form.quantity) : 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.member_id) return toast.error('회원을 선택하세요.')
    if (!form.product_id) return toast.error('상품을 선택하세요.')
    if (!form.channel_id) return toast.error('구매 채널을 선택하세요.')
    setLoading(true)
    const { error } = await supabase.from('sales').insert({
      member_id: form.member_id,
      product_id: Number(form.product_id),
      channel_id: Number(form.channel_id),
      quantity: Number(form.quantity),
      total_price: totalPrice,
      note: form.note || null,
    })
    setLoading(false)
    if (error) { toast.error('저장 실패: ' + error.message); return }
    toast.success('판매가 등록되었습니다!')
    setForm(emptyForm)
    setSelectedMember(null)
    setSelectedProduct(null)
  }

  // 엑셀 파일 선택 → 파싱 → 미리보기
  function handleExcelFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' })

      const rows = []
      for (const row of raw) {
        const nameRaw = row['이름'] || row['name'] || ''
        const phoneRaw = row['전번'] || row['전화'] || row['phone'] || ''
        const channelRaw = row['채널'] || row['channel'] || ''
        const bigoRaw = row['비고'] || row['note'] || ''

        const name = String(nameRaw).replace(/\s*님\s*$/, '').trim()
        const phone = String(phoneRaw).trim()

        // 회원 매칭 (이름 or 전번)
        const member = members.find(m =>
          m.name === name ||
          m.phone === phone ||
          m.phone.replace(/-/g, '') === phone.replace(/-/g, '')
        )

        const channel = matchChannel(channelRaw, channels)
        const items = parseBigo(bigoRaw, products)

        if (items.length === 0) {
          rows.push({ name, phone, channelRaw, bigoRaw, member, channel, items: [], error: '상품 파싱 실패' })
        } else {
          for (const item of items) {
            rows.push({ name, phone, channelRaw, bigoRaw, member, channel, product: item.product, qty: item.qty, error: null })
          }
        }
      }
      setImportRows(rows)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  // 일괄 등록
  async function handleImport() {
    const valid = importRows.filter(r => r.channel && r.product && !r.error)
    if (!valid.length) return toast.error('등록 가능한 행이 없습니다.')
    setImporting(true)

    // 미등록 회원 자동 생성 (이름+전번 기준 중복 방지)
    const memberMap = {} // "이름|전번" → member id
    const newMemberKeys = [...new Set(
      valid.filter(r => !r.member).map(r => `${r.name}|${r.phone}`)
    )]
    for (const key of newMemberKeys) {
      const [name, phone] = key.split('|')
      const { data, error } = await supabase.from('members').insert({ name, phone }).select().single()
      if (error) { toast.error(`회원 생성 실패: ${name}`); setImporting(false); return }
      memberMap[key] = data.id
    }

    const inserts = valid.map(r => ({
      member_id: r.member ? r.member.id : memberMap[`${r.name}|${r.phone}`],
      product_id: r.product.id,
      channel_id: r.channel.id,
      quantity: r.qty,
      total_price: r.product.price * r.qty,
      note: r.bigoRaw || null,
    }))
    const { error } = await supabase.from('sales').insert(inserts)
    setImporting(false)
    if (error) { toast.error('일괄 등록 실패: ' + error.message); return }
    const newCount = newMemberKeys.length
    toast.success(`${valid.length}건 등록 완료!${newCount ? ` (신규 회원 ${newCount}명 자동 생성)` : ''}`)
    setImportRows(null)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">판매 입력</h1>

      {/* 엑셀 일괄 입력 */}
      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-700">엑셀 일괄 입력</h2>
            <p className="text-xs text-gray-400 mt-0.5">이름, 전번, 채널, 비고 열이 있는 엑셀 파일을 올려주세요.</p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition"
          >
            엑셀 파일 선택
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelFile} />
        </div>

        {importRows && (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200 mb-3">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">이름</th>
                    <th className="px-3 py-2 text-left">채널</th>
                    <th className="px-3 py-2 text-left">상품</th>
                    <th className="px-3 py-2 text-center">수량</th>
                    <th className="px-3 py-2 text-right">금액</th>
                    <th className="px-3 py-2 text-center">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {importRows.map((r, i) => {
                    const ok = r.member && r.channel && r.product && !r.error
                    return (
                      <tr key={i} className={ok ? '' : 'bg-red-50'}>
                        <td className="px-3 py-2">
                          {r.member
                            ? <span className="text-gray-800">{r.member.name}</span>
                            : <span className="text-red-500">{r.name} (미매칭)</span>}
                        </td>
                        <td className="px-3 py-2">
                          {r.channel
                            ? <span className="text-gray-700">{r.channel.name}</span>
                            : <span className="text-red-500">{r.channelRaw} (미매칭)</span>}
                        </td>
                        <td className="px-3 py-2">
                          {r.product
                            ? <span className="text-gray-700">{r.product.name}</span>
                            : <span className="text-red-500">{r.bigoRaw} (파싱 실패)</span>}
                        </td>
                        <td className="px-3 py-2 text-center">{r.qty || '-'}</td>
                        <td className="px-3 py-2 text-right">
                          {r.product ? (r.product.price * r.qty).toLocaleString() + '원' : '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {ok
                            ? <span className="text-emerald-500 font-medium">OK</span>
                            : <span className="text-red-400 font-medium">오류</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                총 {importRows.length}건 중 등록 가능: <strong className="text-emerald-600">{importRows.filter(r => r.member && r.channel && r.product && !r.error).length}건</strong>
                {importRows.some(r => !r.member || !r.channel || !r.product) && (
                  <span className="text-red-400 ml-2">/ 오류: {importRows.filter(r => !r.member || !r.channel || !r.product || r.error).length}건</span>
                )}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setImportRows(null)} className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">취소</button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {importing ? '등록 중...' : '일괄 등록'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 개별 입력 폼 */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 flex flex-col gap-5">
        <h2 className="text-base font-semibold text-gray-700 -mb-2">개별 입력</h2>

        {/* 회원 검색 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">회원 검색 <span className="text-red-500">*</span></label>
          <div className="relative">
            <input
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="이름 또는 휴대폰 번호 입력"
              value={form.phone}
              onChange={handlePhoneChange}
            />
            {memberSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                {memberSuggestions.map(m => (
                  <li
                    key={m.id}
                    className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm flex justify-between"
                    onClick={() => selectMember(m)}
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-gray-400">{m.phone}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedMember && (
            <div className="mt-2 bg-indigo-50 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
              <span>✅ <strong>{selectedMember.name}</strong> ({selectedMember.phone})</span>
              <button type="button" onClick={() => { setSelectedMember(null); setForm(p => ({ ...p, member_id: '', phone: '' })) }} className="text-gray-400 hover:text-red-400 ml-2">✕</button>
            </div>
          )}
        </div>

        {/* 구매 채널 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">구매 채널 <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-2">
            {channels.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setForm(p => ({ ...p, channel_id: c.id }))}
                className={`px-4 py-2 rounded-full text-sm border transition ${
                  form.channel_id == c.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* 상품 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">상품 <span className="text-red-500">*</span></label>
          <select
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.product_id}
            onChange={handleProductChange}
          >
            <option value="">상품 선택</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} — {p.price.toLocaleString()}원</option>
            ))}
          </select>
        </div>

        {/* 수량 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
          <input
            type="number"
            min={1}
            className="w-24 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.quantity}
            onChange={e => setForm(p => ({ ...p, quantity: Math.max(1, Number(e.target.value)) }))}
          />
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="선택 입력"
            value={form.note}
            onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
          />
        </div>

        {/* 합계 */}
        {totalPrice > 0 && (
          <div className="bg-indigo-50 rounded-lg px-4 py-3 flex justify-between text-sm">
            <span className="text-gray-600">결제 금액</span>
            <span className="font-bold text-indigo-700 text-base">{totalPrice.toLocaleString()}원</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? '저장 중...' : '판매 등록'}
        </button>
      </form>
    </div>
  )
}
