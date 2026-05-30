import './globals.css'
import Link from 'next/link'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: '판매 관리 시스템',
  description: '회원 및 판매 내역 관리',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">
        <Toaster position="top-right" />
        <nav className="bg-indigo-700 text-white shadow">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
            <span className="font-bold text-lg tracking-tight">📊 판매 관리</span>
            <Link href="/" className="hover:text-indigo-200 text-sm font-medium">대시보드</Link>
            <Link href="/members" className="hover:text-indigo-200 text-sm font-medium">회원 관리</Link>
            <Link href="/sales" className="hover:text-indigo-200 text-sm font-medium">판매 입력</Link>
            <Link href="/history" className="hover:text-indigo-200 text-sm font-medium">판매 내역</Link>
            <Link href="/settings" className="hover:text-indigo-200 text-sm font-medium">상품/채널 설정</Link>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
