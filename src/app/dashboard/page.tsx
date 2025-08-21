'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardPage() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>読み込み中...</div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <img 
                src="/main_icon.png" 
                alt="ツナグ" 
                className="h-12 w-12"
              />
              <h1 className="text-3xl font-bold text-gray-900">ツナグ</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                {profile.full_name}さん ({profile.role === 'admin' ? '塾長' : profile.role === 'instructor' ? '講師' : '生徒'})
              </span>
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
        {profile.role === 'admin' && (
  <div className="bg-white shadow rounded-lg p-6">
    <h2 className="text-xl font-bold mb-4">塾長ダッシュボード</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <button
        onClick={() => router.push('/schedule')}
        className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg text-left transition-colors"
      >
        <h3 className="font-medium text-blue-900">スケジュール管理</h3>
        <p className="text-sm text-blue-700">全体のスケジュール確認・管理</p>
      </button>
      <button
        onClick={() => router.push('/instructors')}
        className="bg-green-50 hover:bg-green-100 p-4 rounded-lg text-left transition-colors"
      >
        <h3 className="font-medium text-green-900">講師管理</h3>
        <p className="text-sm text-green-700">講師の登録・管理</p>
      </button>
      <button
        onClick={() => router.push('/students')}
        className="bg-purple-50 hover:bg-purple-100 p-4 rounded-lg text-left transition-colors"
      >
        <h3 className="font-medium text-purple-900">生徒管理</h3>
        <p className="text-sm text-purple-700">生徒の登録・管理</p>
      </button>
    </div>
  </div>
)}

          {profile.role === 'instructor' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">講師ダッシュボード</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => router.push('/schedule')}
                  className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg text-left transition-colors"
                >
                  <h3 className="font-medium text-blue-900">授業スケジュール</h3>
                  <p className="text-sm text-blue-700">今日の授業予定確認</p>
                </button>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-green-900">担当生徒</h3>
                  <p className="text-sm text-green-700">担当生徒の状況確認</p>
                </div>
              </div>
            </div>
          )}

          {profile.role === 'student' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">生徒ダッシュボード</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => router.push('/schedule')}
                  className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg text-left transition-colors"
                >
                  <h3 className="font-medium text-blue-900">今日の授業</h3>
                  <p className="text-sm text-blue-700">本日の予定を確認</p>
                </button>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-green-900">学習記録</h3>
                  <p className="text-sm text-green-700">学習状況を記録</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}