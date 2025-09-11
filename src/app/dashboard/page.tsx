'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  MdDashboard, 
  MdCalendarToday, 
  MdMessage, 
  MdSupervisorAccount, 
  MdSchool, 
  MdAnalytics, 
  MdSettings,
  MdNotifications,
  MdTrendingUp,
  MdEventNote,
  MdManageAccounts,
  MdChat,
  MdPlayCircleOutline
} from 'react-icons/md'

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
      <header className="bg-white shadow-sm border-b-2 border-[#8DCCB3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <img 
                src="/main_icon.png" 
                alt="ツナグ" 
                className="h-12 w-12"
              />
              <h1 className="text-3xl font-bold text-[#8DCCB3]">ツナグ</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600 font-medium">
                {profile.full_name}さん ({profile.role === 'admin' ? '塾長' : profile.role === 'instructor' ? '講師' : '生徒'})
              </span>
              <button
                onClick={handleSignOut}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
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
  <div className="flex flex-col lg:flex-row gap-6">
    {/* サイドバー */}
    <div className="w-full lg:w-80">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center">
          <MdDashboard className="mr-2 text-[#8DCCB3]" />
          塾長メニュー
        </h2>
        
        <div className="space-y-3">
          {/* 管理カテゴリ */}
          <div className="border-l-4 border-[#8DCCB3] pl-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <MdManageAccounts className="mr-2 text-[#8DCCB3]" size={16} />
              管理
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/schedule')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <MdCalendarToday className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">スケジュール管理</div>
                  <div className="text-xs text-gray-500">授業予定の確認・調整</div>
                </div>
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>
              
              <button
                onClick={() => router.push('/instructors')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <MdSupervisorAccount className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">講師管理</div>
                  <div className="text-xs text-gray-500">講師の登録・情報管理</div>
                </div>
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>
              
              <button
                onClick={() => router.push('/students')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <MdSchool className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">生徒管理</div>
                  <div className="text-xs text-gray-500">生徒の登録・情報管理</div>
                </div>
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>
            </div>
          </div>

          {/* コミュニケーションカテゴリ */}
          <div className="border-l-4 border-[#B8E0D0] pl-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <MdChat className="mr-2 text-[#8DCCB3]" size={16} />
              コミュニケーション
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/messages')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md relative"
              >
                <MdMessage className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">メッセージ</div>
                  <div className="text-xs text-gray-500">直接メッセージの送受信</div>
                </div>
                {unreadCount > 0 && (
                  <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center font-bold mr-2">
                    {unreadCount}
                  </div>
                )}
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>
              
              <button
                onClick={() => router.push('/message-admin')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <MdNotifications className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">全体メッセージ管理</div>
                  <div className="text-xs text-gray-500">全ての会話を確認・管理</div>
                </div>
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>
            </div>
          </div>

          {/* 分析カテゴリ */}
          <div className="border-l-4 border-[#5FA084] pl-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <MdAnalytics className="mr-2 text-[#8DCCB3]" size={16} />
              分析
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/learning-admin')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <MdAnalytics className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">学習記録分析</div>
                  <div className="text-xs text-gray-500">全生徒の学習状況把握</div>
                </div>
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>

              <button
                onClick={() => router.push('/test-scores')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <MdTrendingUp className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">テスト成績管理</div>
                  <div className="text-xs text-gray-500">定期考査の成績入力・推移分析</div>
                </div>
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* メインエリア */}
    <div className="flex-1">
      <div className="bg-white shadow rounded-lg p-6 border-t-4 border-[#8DCCB3]">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center">
          <MdEventNote className="mr-2 text-[#8DCCB3]" />
          本日の授業予定
        </h3>
        <div className="space-y-3">
          <div className="flex items-center p-3 bg-[#8DCCB3]/5 rounded-lg border border-[#8DCCB3]/10">
            <div className="w-2 h-2 bg-[#8DCCB3] rounded-full mr-3"></div>
            <div>
              <div className="font-medium text-gray-800">14:00 - 数学</div>
              <div className="text-sm text-gray-600">田中太郎 - 教室A</div>
            </div>
          </div>
          <div className="flex items-center p-3 bg-[#8DCCB3]/5 rounded-lg border border-[#8DCCB3]/10">
            <div className="w-2 h-2 bg-[#B8E0D0] rounded-full mr-3"></div>
            <div>
              <div className="font-medium text-gray-800">16:00 - 英語</div>
              <div className="text-sm text-gray-600">佐藤花子 - 教室B</div>
            </div>
          </div>
          <button 
            onClick={() => router.push('/schedule')}
            className="w-full text-center py-3 text-[#8DCCB3] hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 text-sm font-medium border border-[#8DCCB3]/20 hover:border-[#8DCCB3]/40"
          >
            全ての予定を表示 →
          </button>
        </div>
      </div>
    </div>
  </div>
)}
{profile.role === 'instructor' && (
  <div className="flex flex-col lg:flex-row gap-6">
    {/* 講師サイドバー */}
    <div className="w-full lg:w-80">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center">
          <MdSupervisorAccount className="mr-2 text-[#8DCCB3]" />
          講師メニュー
        </h2>
        
        <div className="space-y-3">
          {/* 授業カテゴリ */}
          <div className="border-l-4 border-[#8DCCB3] pl-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <MdCalendarToday className="mr-2 text-[#8DCCB3]" size={16} />
              授業
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/schedule')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <MdCalendarToday className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">授業スケジュール</div>
                  <div className="text-xs text-gray-500">今日の授業予定確認</div>
                </div>
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>
            </div>
          </div>

          {/* コミュニケーションカテゴリ */}
          <div className="border-l-4 border-[#B8E0D0] pl-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <MdChat className="mr-2 text-[#8DCCB3]" size={16} />
              コミュニケーション
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/messages')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <MdMessage className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">メッセージ</div>
                  <div className="text-xs text-gray-500">担当生徒とのやりとり</div>
                </div>
                {unreadCount > 0 && (
                  <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center font-bold mr-2">
                    {unreadCount}
                  </div>
                )}
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* 講師メインエリア */}
    <div className="flex-1">
      <div className="bg-white shadow rounded-lg p-6 border-t-4 border-[#8DCCB3]">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center">
          <MdSchool className="mr-2 text-[#8DCCB3]" />
          担当生徒の状況
        </h3>
        <div className="space-y-3">
          <div className="flex items-center p-3 bg-[#8DCCB3]/5 rounded-lg border border-[#8DCCB3]/10">
            <div className="w-2 h-2 bg-[#8DCCB3] rounded-full mr-3"></div>
            <div>
              <div className="font-medium text-gray-800">田中太郎 - 数学</div>
              <div className="text-sm text-gray-600">次回: 明日 14:00</div>
            </div>
          </div>
          <div className="flex items-center p-3 bg-[#8DCCB3]/5 rounded-lg border border-[#8DCCB3]/10">
            <div className="w-2 h-2 bg-[#B8E0D0] rounded-full mr-3"></div>
            <div>
              <div className="font-medium text-gray-800">佐藤花子 - 英語</div>
              <div className="text-sm text-gray-600">次回: 木曜 16:00</div>
            </div>
          </div>
          <button 
            onClick={() => router.push('/students')}
            className="w-full text-center py-3 text-[#8DCCB3] hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 text-sm font-medium border border-[#8DCCB3]/20 hover:border-[#8DCCB3]/40"
          >
            全ての担当生徒を表示 →
          </button>
        </div>
      </div>
    </div>
  </div>
)}
{profile.role === 'student' && (
  <div className="flex flex-col lg:flex-row gap-6">
    {/* 生徒サイドバー */}
    <div className="w-full lg:w-80">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center">
          <MdSchool className="mr-2 text-[#8DCCB3]" />
          生徒メニュー
        </h2>
        
        <div className="space-y-3">
          {/* 学習カテゴリ */}
          <div className="border-l-4 border-[#8DCCB3] pl-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <MdCalendarToday className="mr-2 text-[#8DCCB3]" size={16} />
              学習
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/schedule')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <MdCalendarToday className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">今日の授業</div>
                  <div className="text-xs text-gray-500">本日の予定を確認</div>
                </div>
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>
              
              <button
                onClick={() => router.push('/learning-records')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <MdAnalytics className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">学習記録</div>
                  <div className="text-xs text-gray-500">学習状況を記録</div>
                </div>
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>

              <button
                onClick={() => router.push('/my-test-scores')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <MdTrendingUp className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">マイ成績</div>
                  <div className="text-xs text-gray-500">テスト結果の入力・確認</div>
                </div>
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>
            </div>
          </div>

          {/* 映像授業カテゴリ */}
          <div className="border-l-4 border-[#5FA084] pl-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <MdPlayCircleOutline className="mr-2 text-[#8DCCB3]" size={16} />
              映像授業
            </h3>
            <div className="space-y-2">
              <div className="bg-gradient-to-r from-[#8DCCB3]/10 to-[#B8E0D0]/10 p-4 rounded-lg border border-[#8DCCB3]/20">
                <h4 className="text-sm font-medium text-gray-800 mb-3 text-center">ブロードバンド予備校</h4>
                <div className="flex justify-center mb-3">
                  <img 
                    src="/qr_bby.png" 
                    alt="ブロードバンド予備校QRコード"
                    className="w-32 h-32 border-2 border-white rounded-lg shadow-md"
                  />
                </div>
                <p className="text-xs text-gray-600 text-center leading-relaxed">
                  iPadでQRコードを読み取って<br />
                  映像授業にアクセス
                </p>
              </div>
            </div>
          </div>

          {/* コミュニケーションカテゴリ */}
          <div className="border-l-4 border-[#B8E0D0] pl-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <MdChat className="mr-2 text-[#8DCCB3]" size={16} />
              コミュニケーション
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/messages')}
                className="w-full flex items-center p-3 text-left hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 group border border-transparent hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <MdMessage className="mr-3 text-[#8DCCB3] group-hover:text-[#5FA084]" size={20} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 group-hover:text-gray-800">メッセージ</div>
                  <div className="text-xs text-gray-500">講師とのやりとり</div>
                </div>
                {unreadCount > 0 && (
                  <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center font-bold mr-2">
                    {unreadCount}
                  </div>
                )}
                <div className="text-[#8DCCB3]/60 group-hover:text-[#8DCCB3]">›</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* 生徒メインエリア */}
    <div className="flex-1">
      <div className="bg-white shadow rounded-lg p-6 border-t-4 border-[#8DCCB3]">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center">
          <MdTrendingUp className="mr-2 text-[#8DCCB3]" />
          学習状況
        </h3>
        <div className="space-y-3">
          <div className="flex items-center p-3 bg-[#8DCCB3]/5 rounded-lg border border-[#8DCCB3]/10">
            <div className="w-2 h-2 bg-[#8DCCB3] rounded-full mr-3"></div>
            <div>
              <div className="font-medium text-gray-800">今週の学習時間</div>
              <div className="text-sm text-gray-600">12時間 / 目標15時間</div>
            </div>
          </div>
          <div className="flex items-center p-3 bg-[#8DCCB3]/5 rounded-lg border border-[#8DCCB3]/10">
            <div className="w-2 h-2 bg-[#B8E0D0] rounded-full mr-3"></div>
            <div>
              <div className="font-medium text-gray-800">次回授業予定</div>
              <div className="text-sm text-gray-600">明日 14:00 - 数学</div>
            </div>
          </div>
          <button 
            onClick={() => router.push('/learning-records')}
            className="w-full text-center py-3 text-[#8DCCB3] hover:bg-[#8DCCB3]/10 rounded-lg transition-all duration-200 text-sm font-medium border border-[#8DCCB3]/20 hover:border-[#8DCCB3]/40"
          >
            詳しい学習記録を確認 →
          </button>
        </div>
      </div>
    </div>
  </div>
)}
        </div>
      </main>
    </div>
  )
}