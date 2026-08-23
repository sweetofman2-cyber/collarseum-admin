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

// 일별 집계: 실제 주문일(ordered_at)이 있으면 그걸 쓴다.
// sale_month만 있고 ordered_at이 없는 건(과거 엑셀 대량 등록 데이터)은 정확한 날짜를
// 알 수 없으므로 제외한다(대량 등록을 실행한 날에 몰아서 잡히는 왜곡 방지).
// 둘 다 없는 개별 입력 건은 저장 시각(sold_at)을 판매일로 간주한다.
function dayOf(s) {
  if (s.ordered_at) return s.ordered_at.slice(0, 10)
  if (s.sale_month) return null
  if (s.sold_at) return s.sold_at.slice(0, 10)
  return null
}

export default function RevenuePage() {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [trendMode, setTrendMode] = useState('monthly') // 'yearly' | 'monthly' | 'daily'

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('sales')
        .select('total_price, sale_month, sold_at, ordered_at, channels(name)')
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

  const dailyTrend = useMemo(() => {
    const map = {}
    for (const s of sales) {
      const day = dayOf(s)
      if (!day) continue
      if (!map[day]) map[day] = { key: day, label: day, total: 0 }
      map[day].total += s.total_price || 0
    }
    return Object.values(map).sort((a, b) => b.key.localeCompare(a.key))
  }, [sales])

  // 일별 보기: 연/월을 선택해서 그 달의 일자만 본다.
  const [dailyYear, setDailyYear] = useState('')
  const [dailyMonth, setDailyMonth] = useState('')

  const dailyYearOptions = useMemo(
    () => Array.from(new Set(dailyTrend.map(t => t.key.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [dailyTrend]
  )
  const dailyMonthOptions = useMemo(
    () => Array.from(new Set(dailyTrend.filter(t => t.key.slice(0, 4) === dailyYear).map(t => t.key.slice(5, 7)))).sort(),
    [dailyTrend, dailyYear]
  )

  useEffect(() => {
    if (dailyTrend.length === 0) return
    if (!dailyYear || !dailyYearOptions.includes(dailyYear)) {
      setDailyYear(dailyTrend[0].key.slice(0, 4))
      setDailyMonth(dailyTrend[0].key.slice(5, 7))
    }
  }, [dailyTrend, dailyYear, dailyYearOptions])

  // 매출이 없는 날도 0원으로 표시하기 위해 선택한 달의 모든 날짜를 채워 넣는다.
  const dailyTrendFiltered = useMemo(() => {
    if (!dailyYear || !dailyMonth) return []
    const byDay = {}
    for (const t of dailyTrend) byDay[t.key] = t.total
    const daysInMonth = new Date(Number(dailyYear), Number(dailyMonth), 0).getDate()
    const result = []
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${dailyYear}-${dailyMonth}-${String(d).padStart(2, '0')}`
      result.push({ key, label: key, total: byDay[key] || 0 })
    }
    return result
  }, [dailyTrend, dailyYear, dailyMonth])

  const yearlyTrend = useMemo(() => {
    const map = {}
    for (const m of monthlyTrend) {
      const year = m.key.slice(0, 4)
      if (!map[year]) map[year] = { key: year, label: year, total: 0 }
      map[year].total += m.total
    }
    return Object.values(map).sort((a, b) => b.key.localeCompare(a.key))
  }, [monthlyTrend])

  const trend = trendMode === 'daily' ? dailyTrendFiltered : trendMode === 'yearly' ? yearlyTrend : monthlyTrend
  const maxTrend = Math.max(...trend.map(t => t.total), 1)

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
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-gray-700">기간별 매출 추이</h2>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => setTrendMode('yearly')}
                  className={`px-3 py-1.5 transition ${trendMode === 'yearly' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  연별
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMode('monthly')}
                  className={`px-3 py-1.5 transition border-l border-gray-300 ${trendMode === 'monthly' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  월별
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMode('daily')}
                  className={`px-3 py-1.5 transition border-l border-gray-300 ${trendMode === 'daily' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  일별
                </button>
              </div>
            </div>

            {trendMode === 'daily' && dailyYearOptions.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <select
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={dailyYear}
                  onChange={e => {
                    const y = e.target.value
                    setDailyYear(y)
                    const monthsForYear = Array.from(new Set(dailyTrend.filter(t => t.key.slice(0, 4) === y).map(t => t.key.slice(5, 7)))).sort()
                    setDailyMonth(monthsForYear[monthsForYear.length - 1] || '')
                  }}
                >
                  {dailyYearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={dailyMonth}
                  onChange={e => setDailyMonth(e.target.value)}
                >
                  {dailyMonthOptions.map(m => <option key={m} value={m}>{Number(m)}월</option>)}
                </select>
              </div>
            )}

            <p className="text-xs text-gray-400 mb-5">
              {trendMode === 'daily'
                ? `${dailyYear}년 ${Number(dailyMonth) || ''}월 일별 매출 합계 (${trend.length}일) · 정확한 날짜 정보가 있는 판매 건 기준`
                : trendMode === 'yearly'
                ? `연도별 매출 합계 (${trend.length}년)`
                : `월별 매출 합계 (${trend.length}개월)`}
            </p>
            {trend.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">표시할 매출 데이터가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-end gap-2 h-52 min-w-max px-1">
                  {trend.map(t => (
                    <div
                      key={t.key}
                      className="w-9 shrink-0 flex flex-col items-center justify-end h-full"
                      title={`${t.label}: ${t.total.toLocaleString()}원`}
                    >
                      <span className="text-[10px] text-gray-500 mb-1 whitespace-nowrap">
                        {t.total === 0 ? '0원' : t.total >= 10000 ? `${Math.round(t.total / 10000)}만` : t.total.toLocaleString()}
                      </span>
                      <div
                        className={`w-full rounded-t-md ${t.total === 0 ? 'bg-gray-100' : 'bg-brand-500'}`}
                        style={{ height: t.total === 0 ? '2%' : `${Math.max((t.total / maxTrend) * 100, 2)}%` }}
                      />
                      <span className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">
                        {trendMode === 'daily' ? `${Number(t.label.slice(8))}일` : trendMode === 'yearly' ? t.label : t.label.slice(2)}
                      </span>
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
