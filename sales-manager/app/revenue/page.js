'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// "202204"(YYYYMM) 또는 "2607"(YYMM) 형식이 섞여 있어 정규화한다.
function normalizeMonth(sm) {
  if (!sm) return null
  const s = String(sm).trim()
  if (/^\d{6}$/.test(s)) {
    return { key: s, label: `${s.slice(0, 4)}-${s.slice(4, 6)}` }
  }
  if (/^\d{4}$/.test(s)) {
    const yyyy = '20' + s.slice(0, 2)
    const mm = s.slice(2, 4)
    return { key: yyyy + mm, label: `${yyyy}-${mm}` }
  }
  return null
}

// sale_month이 비어 있는 개별 입력 건은 판매일(sold_at)로 대체한다.
function periodOf(s) {
  const norm = normalizeMonth(s.sale_month)
  if (norm) return norm
  if (s.sold_at) {
    const ym = s.sold_at.slice(0, 7) // "YYYY-MM"
    return { key: ym.replace('-', ''), label: ym }
  }
  return null
}

export default function RevenuePage() {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('sales')
        .select('total_price, sale_month, sold_at, channels(name)')
        .limit(10000)
      setSales(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const totalRevenue = useMemo(() => sales.reduce((sum, s) => sum + (s.total_price || 0), 0), [sales])

  const monthlyTrend = useMemo(() => {
    const map = {}
    for (const s of sales) {
      const p = periodOf(s)
      if (!p) continue
      if (!map[p.key]) map[p.key] = { key: p.key, label: p.label, total: 0 }
      map[p.key].total += s.total_price || 0
    }
    return Object.values(map).sort((a, b) => b.key.localeCompare(a.key))
  }, [sales])
  const maxMonthly = Math.max(...monthlyTrend.map(m => m.total), 1)

  const channelBreakdown = useMemo(() => {
    const map = {}
    for (const s of sales) {
      const name = s.channels?.name || '미지정'
      map[name] = (map[name] || 0) + (s.total_price || 0)
    }
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [sales])
  const maxChannel = channelBreakdown[0]?.total || 1

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">매출 내역</h1>

      {loading ? (
        <p className="text-center py-10 text-gray-400">로딩 중...</p>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 flex items-center justify-between">
            <span className="text-sm text-gray-500">전체 누적 매출</span>
            <span className="text-2xl font-bold text-brand-700">{totalRevenue.toLocaleString()}원</span>
          </div>

          {/* 기간별 매출 추이 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-1">기간별 매출 추이</h2>
            <p className="text-xs text-gray-400 mb-5">월별 매출 합계 ({monthlyTrend.length}개월)</p>
            {monthlyTrend.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">표시할 매출 데이터가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-end gap-2 h-52 min-w-max px-1">
                  {monthlyTrend.map(m => (
                    <div
                      key={m.key}
                      className="w-9 shrink-0 flex flex-col items-center justify-end h-full"
                      title={`${m.label}: ${m.total.toLocaleString()}원`}
                    >
                      <span className="text-[10px] text-gray-500 mb-1 whitespace-nowrap">
                        {m.total >= 10000 ? `${Math.round(m.total / 10000)}만` : m.total.toLocaleString()}
                      </span>
                      <div
                        className="w-full bg-brand-500 rounded-t-md"
                        style={{ height: `${Math.max((m.total / maxMonthly) * 100, 2)}%` }}
                      />
                      <span className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">{m.label.slice(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 채널별 매출 비중 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-1">채널별 매출 비중</h2>
            <p className="text-xs text-gray-400 mb-5">전체 기간 기준</p>
            {channelBreakdown.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">표시할 매출 데이터가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {channelBreakdown.map(c => {
                  const pct = totalRevenue ? (c.total / totalRevenue) * 100 : 0
                  return (
                    <div key={c.name} className="flex items-center gap-3" title={`${c.name}: ${c.total.toLocaleString()}원 (${pct.toFixed(1)}%)`}>
                      <span className="w-28 shrink-0 text-sm text-gray-600 truncate">{c.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${Math.max((c.total / maxChannel) * 100, 4)}%` }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-xs text-gray-400 text-right">{pct.toFixed(1)}%</span>
                      <span className="w-28 shrink-0 text-sm font-medium text-gray-700 text-right">{c.total.toLocaleString()}원</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
