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

      // タイムアウトを設定して確実にリダイレクト
      const timer = setTimeout(() => {
        if (user) {
          router.replace('/dashboard')
        } else {
          router.replace('/login')
        }
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [user, loading, router, hasRedirected])

  // デバッグ情報を追加
  useEffect(() => {
    console.log('🏠 Home page - loading:', loading, 'user:', !!user, 'hasRedirected:', hasRedirected)
  }, [loading, user, hasRedirected])

  // リダイレクト中のローディング表示
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#6BB6A8]"></div>
        <p className="mt-4 text-gray-600">読み込み中...</p>
        {!loading && !hasRedirected && (
          <p className="mt-2 text-xs text-gray-400">リダイレクト準備中...</p>
        )}
      </div>
    </div>
  )
}
