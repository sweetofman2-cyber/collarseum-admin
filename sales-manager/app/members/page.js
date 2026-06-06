'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

export default function Members() {
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({ name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null)
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)

  async function fetchMembers() {
    const { data } = await supabase
      .from('members')
      .select('*, sales(id, sale_month)')
      .order('created_at', { ascending: false })
      .limit(10000)
    setMembers(data || [])
  }

  useEffect(() => { fetchMembers() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) return toast.error('이름과 전화번호를 입력하세요.')
    setLoading(true)
    if (editId) {
      const { error } = await supabase.from('members').update({ name: form.name, phone: form.phone }).eq('id', editId)
      if (error) toast.error('수정 실패: ' + error.message)
      else { toast.success('회원 정보가 수정되었습니다.'); setEditId(null) }
    } else {
      const { error } = await supabase.from('members').insert({ name: form.name, phone: form.phone })
      if (error) toast.error('등록 실패: ' + (error.message.includes('unique') ? '이미 등록된 전화번호입니다.' : error.message))
      else toast.success('회원이 등록되었습니다.')
    }
    setForm({ name: '', phone: '' })
    setLoading(false)
    fetchMembers()
  }

  async function handleDelete(id) {
    if (!confirm('이 회원을 삭제하면 관련 판매 내역도 삭제됩니다. 계속할까요?')) return
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (error) toast.error('삭제 실패')
    else { toast.success('삭제되었습니다.'); fetchMembers() }
  }

  function startEdit(m) {
    setEditId(m.id)
    setForm({ name: m.name, phone: m.phone })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filtered = members.filter(m =>
    m.name.includes(search) || m.phone.includes(search)
  )

  function downloadExcel() {
    const rows = filtered.map((m, i) => {
      const months = [...new Set((m.sales || []).map(s => s.sale_month).filter(Boolean))].sort()
      return {
        번호: i + 1,
        이름: m.name,
        휴대폰: m.phone || '',
        구매횟수: m.sales?.length ?? 0,
        판매월: months.join(', '),
        등록일: m.created_at?.slice(0, 10),
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '회원목록')
    XLSX.writeFile(wb, `회원목록_${new Date().toISOString().slice(0,10)}.xlsx`)
  }
  const paged = pageSize === 0 ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">회원 관리</h1>

      {/* 등록/수정 폼 */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          {editId ? '✏️ 회원 정보 수정' : '➕ 회원 등록'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
          <input
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="이름"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          <input
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="휴대폰 번호 (010-0000-0000)"
            value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? '처리 중...' : editId ? '수정 저장' : '등록'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => { setEditId(null); setForm({ name: '', phone: '' }) }}
              className="bg-gray-100 text-gray-600 px-5 py-2 rounded-lg text-sm hover:bg-gray-200 transition"
            >
              취소
            </button>
          )}
        </form>
      </div>

      {/* 검색 */}
      <div className="mb-4">
        <input
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="이름 또는 전화번호 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="ml-3 text-sm text-gray-500">총 {filtered.length}명</span>
        <button onClick={downloadExcel} className="ml-3 bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-emerald-600 transition">엑셀 다운로드</button>
        <select
          className="ml-auto border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={pageSize}
          onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
        >
          {[10, 50, 100, 200].map(n => <option key={n} value={n}>{n}개씩 보기</option>)}
          <option value={0}>전체 보기</option>
        </select>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3">번호</th>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">휴대폰</th>
              <th className="px-4 py-3">구매 횟수</th>
              <th className="px-4 py-3">판매월</th>
              <th className="px-4 py-3">등록일</th>
              <th className="px-4 py-3">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">회원이 없습니다.</td></tr>
            ) : paged.map((m, i) => {
              const rowNum = pageSize === 0 ? i + 1 : (page - 1) * pageSize + i + 1
              const months = [...new Set(
                (m.sales || []).map(s => s.sale_month).filter(Boolean)
              )].sort()
              return (
              <tr key={m.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400 text-xs">{rowNum}</td>
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-gray-600">{m.phone}</td>
                <td className="px-4 py-3 text-center">
                  <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs">
                    {m.sales?.length ?? 0}회
                  </span>
                </td>
                <td className="px-4 py-3">
                  {months.length === 0
                    ? <span className="text-gray-300">-</span>
                    : <div className="flex flex-wrap gap-1">
                        {months.map(mo => (
                          <span key={mo} className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full">{mo}</span>
                        ))}
                      </div>
                  }
                </td>
                <td className="px-4 py-3 text-gray-400">{m.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => startEdit(m)} className="text-indigo-500 hover:underline text-xs">수정</button>
                  <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:underline text-xs">삭제</button>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50">이전</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2).map((p, i, arr) => (
            <span key={p}>
              {i > 0 && arr[i - 1] !== p - 1 && <span className="px-2 py-1.5 text-gray-400">…</span>}
              <button onClick={() => setPage(p)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${p === page ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:bg-gray-50'}`}>{p}</button>
            </span>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50">다음</button>
        </div>
      )}
    </div>
  )
}
