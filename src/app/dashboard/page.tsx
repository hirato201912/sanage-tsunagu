'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (profile) {
      fetchUnreadCount()
      // リアルタイム更新
      const channel = supabase
        .channel('unread_messages')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${profile.id}`
        }, () => {
          fetchUnreadCount()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [profile])

  const fetchUnreadCount = async () => {
    if (!profile) return

    try {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', profile.id)
        .eq('is_read', false)

      setUnreadCount(count || 0)
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
  }

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <button
        onClick={() => router.push('/schedule')}
        className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg text-left transition-colors"
      >
        <h3 className="font-medium text-blue-900">スケジュール管理</h3>
        <p className="text-sm text-blue-700">全体のスケジュール確認・管理</p>
      </button>
      <button
        onClick={() => router.push('/messages')}
        className="bg-green-50 hover:bg-green-100 p-4 rounded-lg text-left transition-colors relative"
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-green-900">メッセージ</h3>
            <p className="text-sm text-green-700">直接メッセージの送受信</p>
          </div>
          {unreadCount > 0 && (
            <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center font-bold">
              {unreadCount}
            </div>
          )}
        </div>
      </button>
      <button
        onClick={() => router.push('/message-admin')}
        className="bg-amber-50 hover:bg-amber-100 p-4 rounded-lg text-left transition-colors"
      >
        <h3 className="font-medium text-amber-900">メッセージ管理</h3>
        <p className="text-sm text-amber-700">全ての会話を確認・管理</p>
      </button>
      <button
        onClick={() => router.push('/instructors')}
        className="bg-purple-50 hover:bg-purple-100 p-4 rounded-lg text-left transition-colors"
      >
        <h3 className="font-medium text-purple-900">講師管理</h3>
        <p className="text-sm text-purple-700">講師の登録・管理</p>
      </button>
      <button
        onClick={() => router.push('/students')}
        className="bg-orange-50 hover:bg-orange-100 p-4 rounded-lg text-left transition-colors"
      >
        <h3 className="font-medium text-orange-900">生徒管理</h3>
        <p className="text-sm text-orange-700">生徒の登録・管理</p>
      </button>
      <button
        onClick={() => router.push('/learning-admin')}
        className="bg-indigo-50 hover:bg-indigo-100 p-4 rounded-lg text-left transition-colors"
      >
        <h3 className="font-medium text-indigo-900">学習記録管理</h3>
        <p className="text-sm text-indigo-700">全生徒の学習状況を確認</p>
      </button>
    </div>
  </div>
)}
{profile.role === 'instructor' && (
  <div className="bg-white shadow rounded-lg p-6">
    <h2 className="text-xl font-bold mb-4">講師ダッシュボード</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <button
        onClick={() => router.push('/schedule')}
        className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg text-left transition-colors"
      >
        <h3 className="font-medium text-blue-900">授業スケジュール</h3>
        <p className="text-sm text-blue-700">今日の授業予定確認</p>
      </button>
      <button
        onClick={() => router.push('/messages')}
        className="bg-green-50 hover:bg-green-100 p-4 rounded-lg text-left transition-colors relative"
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-green-900">メッセージ</h3>
            <p className="text-sm text-green-700">担当生徒とのやりとり</p>
          </div>
          {unreadCount > 0 && (
            <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center font-bold">
              {unreadCount}
            </div>
          )}
        </div>
      </button>
      <div className="bg-purple-50 p-4 rounded-lg">
        <h3 className="font-medium text-purple-900">担当生徒</h3>
        <p className="text-sm text-purple-700">担当生徒の状況確認</p>
      </div>
    </div>
  </div>
)}
{profile.role === 'student' && (
  <div className="bg-white shadow rounded-lg p-6">
    <h2 className="text-xl font-bold mb-4">生徒ダッシュボード</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <button
        onClick={() => router.push('/schedule')}
        className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg text-left transition-colors"
      >
        <h3 className="font-medium text-blue-900">今日の授業</h3>
        <p className="text-sm text-blue-700">本日の予定を確認</p>
      </button>
      <button
        onClick={() => router.push('/messages')}
        className="bg-green-50 hover:bg-green-100 p-4 rounded-lg text-left transition-colors relative"
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-green-900">メッセージ</h3>
            <p className="text-sm text-green-700">講師とのやりとり</p>
          </div>
          {unreadCount > 0 && (
            <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center font-bold">
              {unreadCount}
            </div>
          )}
        </div>
      </button>
      <button
        onClick={() => router.push('/learning-records')}
        className="bg-purple-50 hover:bg-purple-100 p-4 rounded-lg text-left transition-colors"
      >
        <h3 className="font-medium text-purple-900">学習記録</h3>
        <p className="text-sm text-purple-700">学習状況を記録</p>
      </button>
    </div>
  </div>
)}
        </div>
      </main>
    </div>
  )
}