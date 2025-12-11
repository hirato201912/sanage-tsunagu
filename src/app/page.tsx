'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [hasRedirected, setHasRedirected] = useState(false)

  useEffect(() => {
    // すでにリダイレクト済みなら何もしない
    if (hasRedirected) return

    // loadingが完了したらリダイレクト
    if (!loading) {
      setHasRedirected(true)

      // リダイレクト先を決定
      const targetUrl = user ? '/dashboard' : '/login'

      // すぐにリダイレクト
      const timer = setTimeout(() => {
        router.replace(targetUrl)
      }, 50)

      return () => clearTimeout(timer)
    }
  }, [user, loading, router, hasRedirected])


  // リダイレクト中のローディング表示
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#8DCCB3]/5 via-white to-[#B8E0D0]/10">
      <div className="text-center">
        {/* ロゴ画像 - 静止 */}
        <div className="mb-6 animate-pulse">
          <img
            src="/main_icon.png"
            alt="ツナグ"
            className="h-24 w-24 mx-auto opacity-90"
          />
        </div>

        {/* ソフトなスピナー */}
        <div className="flex justify-center mb-4">
          <div className="flex gap-2">
            <div className="w-2 h-2 bg-[#6BB6A8] rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
            <div className="w-2 h-2 bg-[#8DCCB3] rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
            <div className="w-2 h-2 bg-[#B8E0D0] rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
          </div>
        </div>

        {/* 優しいメッセージ */}
        <p className="text-gray-600 text-sm font-medium">準備しています</p>
        <p className="mt-1 text-gray-400 text-xs">少々お待ちください</p>
      </div>
    </div>
  )
}
