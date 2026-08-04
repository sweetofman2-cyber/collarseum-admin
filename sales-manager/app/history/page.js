'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

export default function History() {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [channels, setChannels] = useState([])
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)

  async function fetchSales() {
    setLoading(true)
    const { data } = await supabase
      .from('sales')
      .select('*, members(name, phone), products(name, price), channels(name)')
      .order('sold_at', { ascending: false })
      .limit(10000)
    setSales(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchSales()
    supabase.from('channels').select('*').order('id').then(({ data }) => setChannels(data || []))
  }, [])

  async function handleDelete(id) {
    if (!confirm('이 판매 내역을 삭제할까요?')) return
    const { error } = await supabase.from('sales').delete().eq('id', id)
    if (error) toast.error('삭제 실패')
    else { toast.success('삭제되었습니다.'); fetchSales() }
  }

  const months = [...new Set(sales.map(s => s.sale_month).filter(Boolean))].sort()

  const filtered = sales.filter(s => {
    const displayName = s.members?.name || s.receiver_name || ''
    const displayPhone = s.members?.phone || s.receiver_phone || ''
    const displayProduct = s.products?.name || s.item_detail || ''
    const matchSearch = !search ||
      displayName.includes(search) ||
      displayPhone.includes(search) ||
      displayProduct.includes(search)
    const matchChannel = !channelFilter || s.channels?.name === channelFilter
    const matchMonth = !monthFilter || s.sale_month === monthFilter
    return matchSearch && matchChannel && matchMonth
  })

  const totalRevenue = filtered.reduce((sum, s) => sum + (s.total_price || 0), 0)

  function downloadExcel() {
    const rows = filtered.map((s, i) => ({
      번호: i + 1,
      회원명: s.members?.name || s.receiver_name || '',
      전화번호: s.members?.phone || s.receiver_phone || '',
      상품: s.products?.name || s.item_detail || '',
      채널: s.channels?.name || '',
      수량: s.quantity,
      금액: s.total_price,
      판매월: s.sale_month || '',
      메모: s.note || '',
      판매일: s.sold_at?.slice(0, 16).replace('T', ' '),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '판매내역')
    XLSX.writeFile(wb, `판매내역_${new Date().toISOString().slice(0,10)}.xlsx`)
  }
  const paged = pageSize === 0 ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">판매 내역</h1>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-56"
          placeholder="회원명 / 전화번호 / 상품 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value)}
        >
          <option value="">전체 채널</option>
          {channels.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
        >
          <option value="">전체 판매월</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-sm text-gray-500">{filtered.length}건</span>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          value={pageSize}
          onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
        >
          {[10, 50, 100, 200].map(n => <option key={n} value={n}>{n}개씩 보기</option>)}
          <option value={0}>전체 보기</option>
        </select>
        <button onClick={downloadExcel} className="bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-emerald-600 transition">엑셀 다운로드</button>
        <span className="ml-auto text-sm font-medium text-brand-700">합계: {totalRevenue.toLocaleString()}원</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-center py-10 text-gray-400">로딩 중...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">번호</th>
                <th className="px-4 py-3">회원명</th>
                <th className="px-4 py-3">전화번호</th>
                <th className="px-4 py-3">상품</th>
                <th className="px-4 py-3">채널</th>
                <th className="px-4 py-3 text-center">수량</th>
                <th className="px-4 py-3 text-right">금액</th>
                <th className="px-4 py-3">판매월</th>
                <th className="px-4 py-3">메모</th>
                <th className="px-4 py-3">판매일</th>
                <th className="px-4 py-3">삭제</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">내역이 없습니다.</td></tr>
              ) : paged.map((s, i) => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs">{pageSize === 0 ? i + 1 : (page - 1) * pageSize + i + 1}</td>
                  <td className="px-4 py-3 font-medium">{s.members?.name || s.receiver_name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.members?.phone || s.receiver_phone}</td>
                  <td className="px-4 py-3">{s.products?.name || s.item_detail}</td>
                  <td className="px-4 py-3">
                    <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full text-xs">{s.channels?.name}</span>
                  </td>
                  <td className="px-4 py-3 text-center">{s.quantity}</td>
                  <td className="px-4 py-3 text-right font-medium text-brand-700">{s.total_price?.toLocaleString()}원</td>
                  <td className="px-4 py-3 text-xs">
                    {s.sale_month
                      ? <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{s.sale_month}</span>
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{s.note || '-'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{s.sold_at?.slice(0, 16).replace('T', ' ')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:underline text-xs">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50">이전</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2).map((p, i, arr) => (
            <span key={p}>
              {i > 0 && arr[i - 1] !== p - 1 && <span className="px-2 py-1.5 text-gray-400">…</span>}
              <button onClick={() => setPage(p)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${p === page ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 hover:bg-gray-50'}`}>{p}</button>
            </span>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50">다음</button>
        </div>
      )}
    </div>
  )
}
