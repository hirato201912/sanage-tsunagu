'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getAndClearLastPage } from '@/utils/navigation'
import LoadingScreen from '@/components/LoadingScreen'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [hasRedirected, setHasRedirected] = useState(false)
  // 保存されたページを一度だけ取得（React Strict Mode対策）
  const savedPageRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    // すでにリダイレクト済みなら何もしない
    if (hasRedirected) return

    // 保存されたページを一度だけ取得（初回のみ）
    if (savedPageRef.current === undefined) {
      savedPageRef.current = getAndClearLastPage()
    }

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
        targetUrl = savedPageRef.current || '/dashboard'
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
  return <LoadingScreen />
}
