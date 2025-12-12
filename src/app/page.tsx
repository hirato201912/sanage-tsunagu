'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getAndClearLastPage } from '@/utils/navigation'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [hasRedirected, setHasRedirected] = useState(false)

  useEffect(() => {
    // すでにリダイレクト済みなら何もしない
    if (hasRedirected) return

    // 強制リダイレクト: 6秒経っても何も起きない場合はログインページへ
    const forceRedirectTimer = setTimeout(() => {
      if (!hasRedirected) {
        setHasRedirected(true)
        // router.replace が効かない場合のフォールバック
        try {
          router.replace('/login')
        } catch (error) {
          window.location.href = '/login'
        }
      }
    }, 6000)

    // loadingが完了したらリダイレクト
    if (!loading) {
      setHasRedirected(true)
      clearTimeout(forceRedirectTimer)

      // リダイレクト先を決定
      let targetUrl: string

      if (user) {
        // ログイン済みの場合、保存されたページがあればそこに戻る
        const lastPage = getAndClearLastPage()
        targetUrl = lastPage || '/dashboard'
      } else {
        // 未ログインの場合はログインページへ
        targetUrl = '/login'
      }

      // すぐにリダイレクト
      try {
        router.replace(targetUrl)
      } catch (error) {
        // フォールバック: router が使えない場合は直接遷移
        window.location.href = targetUrl
      }
    }

    return () => clearTimeout(forceRedirectTimer)
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
