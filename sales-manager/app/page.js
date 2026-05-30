'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Dashboard() {
  const [stats, setStats] = useState({ members: 0, sales: 0, revenue: 0, today: 0 })
  const [recent, setRecent] = useState([])

  useEffect(() => {
    async function load() {
      const [{ count: memberCount }, { data: salesData }] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }),
        supabase.from('sales').select('total_price, sold_at').order('sold_at', { ascending: false }).limit(100),
      ])

      const today = new Date().toISOString().slice(0, 10)
      const todaySales = salesData?.filter(s => s.sold_at?.slice(0, 10) === today) || []
      const revenue = salesData?.reduce((sum, s) => sum + (s.total_price || 0), 0) || 0

      setStats({
        members: memberCount || 0,
        sales: salesData?.length || 0,
        revenue,
        today: todaySales.reduce((sum, s) => sum + (s.total_price || 0), 0),
      })

      const { data: recentSales } = await supabase
        .from('sales')
        .select('id, sold_at, total_price, quantity, members(name, phone), products(name), channels(name)')
        .order('sold_at', { ascending: false })
        .limit(5)
      setRecent(recentSales || [])
    }
    load()
  }, [])

  const cards = [
    { label: '전체 회원', value: stats.members + '명', color: 'bg-indigo-500', icon: '👥' },
    { label: '전체 판매건', value: stats.sales + '건', color: 'bg-emerald-500', icon: '🛒' },
    { label: '누적 매출', value: stats.revenue.toLocaleString() + '원', color: 'bg-amber-500', icon: '💰' },
    { label: '오늘 매출', value: stats.today.toLocaleString() + '원', color: 'bg-rose-500', icon: '📅' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">대시보드</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className={`${c.color} text-white rounded-xl p-5 shadow`}>
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-sm opacity-80 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-700">최근 판매 내역</h2>
          <Link href="/history" className="text-sm text-indigo-600 hover:underline">전체 보기 →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">판매 내역이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b">
                <th className="pb-2">회원명</th>
                <th className="pb-2">상품</th>
                <th className="pb-2">채널</th>
                <th className="pb-2 text-right">금액</th>
                <th className="pb-2 text-right">일시</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 font-medium">{s.members?.name}</td>
                  <td className="py-2 text-gray-600">{s.products?.name}</td>
                  <td className="py-2 text-gray-500">{s.channels?.name}</td>
                  <td className="py-2 text-right font-medium text-indigo-700">{s.total_price?.toLocaleString()}원</td>
                  <td className="py-2 text-right text-gray-400">{s.sold_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 flex gap-4">
        <Link href="/sales" className="flex-1 bg-indigo-600 text-white text-center py-3 rounded-xl font-medium hover:bg-indigo-700 transition">
          + 판매 입력
        </Link>
        <Link href="/members" className="flex-1 bg-white border border-gray-200 text-gray-700 text-center py-3 rounded-xl font-medium hover:bg-gray-50 transition">
          회원 관리
        </Link>
      </div>
    </div>
  )
}
