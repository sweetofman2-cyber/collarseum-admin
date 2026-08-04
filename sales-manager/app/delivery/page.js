'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const today = new Date().toISOString().slice(0, 10)

export default function DeliveryPage() {
  const [records, setRecords] = useState([])
  const [form, setForm] = useState({ delivery_date: today, count: '', cost_per_item: '', note: '' })
  const [editId, setEditId] = useState(null)
  const [filterMonth, setFilterMonth] = useState(today.slice(0, 7)) // 'YYYY-MM'

  async function fetchRecords() {
    const { data } = await supabase
      .from('deliveries')
      .select('*')
      .order('delivery_date', { ascending: false })
    setRecords(data || [])
  }
  useEffect(() => { fetchRecords() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.delivery_date) return toast.error('날짜를 입력하세요.')
    if (!form.count || Number(form.count) <= 0) return toast.error('택배 수량을 입력하세요.')
    if (!form.cost_per_item || Number(form.cost_per_item) <= 0) return toast.error('건당 택배비를 입력하세요.')
    const payload = {
      delivery_date: form.delivery_date,
      count: Number(form.count),
      cost_per_item: Number(form.cost_per_item),
      note: form.note || null,
    }
    if (editId) {
      const { error } = await supabase.from('deliveries').update(payload).eq('id', editId)
      if (error) toast.error('수정 실패')
      else { toast.success('수정되었습니다.'); setEditId(null) }
    } else {
      const { error } = await supabase.from('deliveries').insert(payload)
      if (error) toast.error('추가 실패: ' + error.message)
      else toast.success('추가되었습니다.')
    }
    setForm({ delivery_date: today, count: '', cost_per_item: '', note: '' })
    fetchRecords()
  }

  async function handleDelete(id) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('deliveries').delete().eq('id', id)
    toast.success('삭제됨')
    fetchRecords()
  }

  // 월별 집계
  const monthlyStats = useMemo(() => {
    const map = {}
    for (const r of records) {
      const ym = r.delivery_date?.slice(0, 7)
      if (!ym) continue
      if (!map[ym]) map[ym] = { count: 0, total_cost: 0 }
      map[ym].count += r.count
      map[ym].total_cost += r.count * r.cost_per_item
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [records])

  const filteredRecords = records.filter(r => r.delivery_date?.startsWith(filterMonth))

  const filteredTotal = useMemo(() => ({
    count: filteredRecords.reduce((s, r) => s + r.count, 0),
    cost: filteredRecords.reduce((s, r) => s + r.count * r.cost_per_item, 0),
  }), [filteredRecords])

  // 조회 가능한 월 목록
  const availableMonths = useMemo(() => {
    const months = new Set(records.map(r => r.delivery_date?.slice(0, 7)).filter(Boolean))
    if (!months.has(today.slice(0, 7))) months.add(today.slice(0, 7))
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [records])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">택배 관리</h1>

      {/* 월별 요약 카드 */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-600 mb-3">월별 요약</h2>
        {monthlyStats.length === 0 ? (
          <p className="text-sm text-gray-400">아직 데이터가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {monthlyStats.map(([ym, stat]) => (
              <button
                key={ym}
                onClick={() => setFilterMonth(ym)}
                className={`rounded-xl p-4 text-left shadow-sm border transition ${filterMonth === ym ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-100 hover:border-brand-300'}`}
              >
                <div className="text-sm font-bold mb-1">{ym}</div>
                <div className={`text-xs ${filterMonth === ym ? 'text-brand-200' : 'text-gray-400'}`}>{stat.count.toLocaleString()}건</div>
                <div className="text-base font-semibold mt-0.5">{stat.total_cost.toLocaleString()}원</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 입력 폼 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4">{editId ? '택배 내역 수정' : '택배 내역 추가'}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">날짜</label>
              <input
                type="date"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.delivery_date}
                onChange={e => setForm(p => ({ ...p, delivery_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">택배 수량 (건)</label>
              <input
                type="number"
                min="1"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="예: 30"
                value={form.count}
                onChange={e => setForm(p => ({ ...p, count: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">건당 택배비 (원)</label>
              <input
                type="number"
                min="0"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="예: 3500"
                value={form.cost_per_item}
                onChange={e => setForm(p => ({ ...p, cost_per_item: e.target.value }))}
              />
            </div>
            {form.count && form.cost_per_item && (
              <div className="bg-brand-50 rounded-lg px-4 py-2 text-sm text-brand-700 font-medium">
                총 택배비: {(Number(form.count) * Number(form.cost_per_item)).toLocaleString()}원
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-1">메모 (선택)</label>
              <input
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="특이사항 등"
                value={form.note}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-brand-700 transition w-full">
                {editId ? '수정 저장' : '추가'}
              </button>
              {editId && (
                <button type="button"
                  onClick={() => { setEditId(null); setForm({ delivery_date: today, count: '', cost_per_item: '', note: '' }) }}
                  className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">취소</button>
              )}
            </div>
          </form>
        </div>

        {/* 월별 상세 내역 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-700">
              상세 내역
            </h2>
            <select
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-400"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* 월 합계 */}
          <div className="flex gap-4 mb-4 bg-gray-50 rounded-lg p-3 text-sm">
            <div>
              <span className="text-gray-400 text-xs">총 건수</span>
              <div className="font-bold text-gray-800">{filteredTotal.count.toLocaleString()}건</div>
            </div>
            <div>
              <span className="text-gray-400 text-xs">총 택배비</span>
              <div className="font-bold text-brand-700">{filteredTotal.cost.toLocaleString()}원</div>
            </div>
            {filteredTotal.count > 0 && (
              <div>
                <span className="text-gray-400 text-xs">건당 평균</span>
                <div className="font-bold text-gray-600">{Math.round(filteredTotal.cost / filteredTotal.count).toLocaleString()}원</div>
              </div>
            )}
          </div>

          {filteredRecords.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">이 달의 데이터가 없습니다.</p>
          ) : (
            <ul className="divide-y max-h-96 overflow-y-auto">
              {filteredRecords.map(r => (
                <li key={r.id} className="py-2.5 flex items-start justify-between text-sm">
                  <div>
                    <div className="font-medium text-gray-800">{r.delivery_date}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {r.count}건 × {r.cost_per_item.toLocaleString()}원
                      = <span className="text-brand-600 font-semibold">{(r.count * r.cost_per_item).toLocaleString()}원</span>
                    </div>
                    {r.note && <div className="text-xs text-gray-400 mt-0.5">{r.note}</div>}
                  </div>
                  <div className="flex gap-2 ml-3 shrink-0">
                    <button
                      onClick={() => {
                        setEditId(r.id)
                        setForm({ delivery_date: r.delivery_date, count: String(r.count), cost_per_item: String(r.cost_per_item), note: r.note || '' })
                      }}
                      className="text-brand-400 hover:underline text-xs">수정</button>
                    <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:underline text-xs">삭제</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
