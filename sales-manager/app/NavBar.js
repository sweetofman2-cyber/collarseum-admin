'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { logout } from '@/lib/auth'

const NAV_ITEMS = [
  { href: '/', label: '대시보드' },
  { href: '/members', label: '회원 관리' },
  { href: '/sales', label: '판매 입력' },
  { href: '/history', label: '판매 내역' },
  { href: '/revenue', label: '매출 내역' },
  { href: '/settings', label: '상품/채널 설정' },
  { href: '/order-upload', label: '각 채널별 주문서' },
  { href: '/delivery', label: '택배 관리' },
]

export default function NavBar() {
  const router = useRouter()
  const pathname = usePathname()

  if (pathname === '/login') return null

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <nav className="bg-navy-800 text-white shadow">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-1">
        <span className="font-bold text-lg tracking-tight text-brand-400 mr-5">판매 관리</span>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${
                active
                  ? 'bg-brand-500 text-white'
                  : 'text-navy-100 hover:bg-navy-700 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
        <div className="ml-auto">
          <button
            onClick={handleLogout}
            className="text-sm text-navy-200 hover:text-brand-400 transition"
          >
            로그아웃
          </button>
        </div>
      </div>
    </nav>
  )
}
