'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { logout } from '@/lib/auth'

export default function NavBar() {
  const router = useRouter()
  const pathname = usePathname()

  if (pathname === '/login') return null

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <nav className="bg-indigo-700 text-white shadow">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
        <span className="font-bold text-lg tracking-tight">📊 판매 관리</span>
        <Link href="/" className="hover:text-indigo-200 text-sm font-medium">대시보드</Link>
        <Link href="/members" className="hover:text-indigo-200 text-sm font-medium">회원 관리</Link>
        <Link href="/sales" className="hover:text-indigo-200 text-sm font-medium">판매 입력</Link>
        <Link href="/history" className="hover:text-indigo-200 text-sm font-medium">판매 내역</Link>
        <Link href="/settings" className="hover:text-indigo-200 text-sm font-medium">상품/채널 설정</Link>
        <Link href="/delivery" className="hover:text-indigo-200 text-sm font-medium">택배 관리</Link>
        <div className="ml-auto">
          <button
            onClick={handleLogout}
            className="text-sm text-indigo-200 hover:text-white transition"
          >
            로그아웃
          </button>
        </div>
      </div>
    </nav>
  )
}
