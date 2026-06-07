import './globals.css'
import Link from 'next/link'
import { Toaster } from 'react-hot-toast'
import AuthGuard from './AuthGuard'
import NavBar from './NavBar'

export const metadata = {
  title: '판매 관리 시스템',
  description: '회원 및 판매 내역 관리',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">
        <Toaster position="top-right" />
        <AuthGuard>
          <NavBar />
          <main className="max-w-6xl mx-auto px-4 py-8">
            {children}
          </main>
        </AuthGuard>
      </body>
    </html>
  )
}
