'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Schedule, Profile } from '@/lib/supabase'
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

interface ScheduleWithProfile extends Schedule {
  student?: Profile
  instructor?: Profile
}

export default function DashboardPage() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [todaySchedules, setTodaySchedules] = useState<ScheduleWithProfile[]>([])
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (profile) {
      fetchUnreadCount()
      fetchTodaySchedules()
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

  const fetchTodaySchedules = async () => {
    if (!profile) return

    setIsLoadingSchedules(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      let query = supabase
        .from('schedules')
        .select(`
          *,
          student:profiles!schedules_student_id_fkey(id, full_name),
          instructor:profiles!schedules_instructor_id_fkey(id, full_name)
        `)
        .eq('lesson_date', today)
        .eq('status', 'scheduled')
        .order('start_time')

      // 管理者は全てのスケジュール、講師・生徒は自分関連のみ
      if (profile.role === 'instructor') {
        query = query.eq('instructor_id', profile.id)
      } else if (profile.role === 'student') {
        query = query.eq('student_id', profile.id)
      }

      const { data, error } = await query

      if (error) throw error
      setTodaySchedules(data || [])
    } catch (error) {
      console.error('Error fetching today schedules:', error)
      setTodaySchedules([])
    } finally {
      setIsLoadingSchedules(false)
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
      <header className="bg-[#6BB6A8] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-5">
            <div className="flex items-center space-x-3">
              <div className="bg-white rounded-xl p-2 shadow-md">
                <img
                  src="/main_icon.png"
                  alt="ツナグ"
                  className="h-9 w-9"
                />
              </div>
              <h1 className="text-2xl font-bold text-white">ツナグ</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 rounded-xl px-4 py-2.5 border border-white/30">
                <span className="text-white font-medium text-sm">
                  {profile.full_name}さん ({profile.role === 'admin' ? '塾長' : profile.role === 'instructor' ? '講師' : '生徒'})
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="bg-white hover:bg-gray-100 text-[#5FA084] px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md"
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
      <div className="bg-white shadow-xl rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center">
          <div className="bg-[#6BB6A8] p-2.5 rounded-xl mr-3 shadow-md">
            <MdDashboard className="text-white" size={20} />
          </div>
          塾長メニュー
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/schedule')}
            className="bg-[#6BB6A8] hover:bg-[#5FA084] rounded-2xl p-4 transition-all duration-200 shadow-md flex flex-col items-center justify-center gap-2 text-white"
          >
            <div className="bg-white/20 p-3 rounded-xl">
              <MdCalendarToday size={24} />
            </div>
            <span className="font-semibold text-sm">スケジュール</span>
          </button>

          <button
            onClick={() => router.push('/instructors')}
            className="bg-[#6BB6A8] hover:bg-[#5FA084] rounded-2xl p-4 transition-all duration-200 shadow-md flex flex-col items-center justify-center gap-2 text-white"
          >
            <div className="bg-white/20 p-3 rounded-xl">
              <MdSupervisorAccount size={24} />
            </div>
            <span className="font-semibold text-sm">講師管理</span>
          </button>

          <button
            onClick={() => router.push('/students')}
            className="bg-[#6BB6A8] hover:bg-[#5FA084] rounded-2xl p-4 transition-all duration-200 shadow-md flex flex-col items-center justify-center gap-2 text-white"
          >
            <div className="bg-white/20 p-3 rounded-xl">
              <MdSchool size={24} />
            </div>
            <span className="font-semibold text-sm">生徒管理</span>
          </button>

          <button
            onClick={() => router.push('/test-scores')}
            className="bg-[#6BB6A8] hover:bg-[#5FA084] rounded-2xl p-4 transition-all duration-200 shadow-md flex flex-col items-center justify-center gap-2 text-white"
          >
            <div className="bg-white/20 p-3 rounded-xl">
              <MdTrendingUp size={24} />
            </div>
            <span className="font-semibold text-sm">成績管理</span>
          </button>

          <button
            onClick={() => router.push('/learning-admin')}
            className="bg-[#6BB6A8] hover:bg-[#5FA084] rounded-2xl p-4 transition-all duration-200 shadow-md flex flex-col items-center justify-center gap-2 text-white"
          >
            <div className="bg-white/20 p-3 rounded-xl">
              <MdAnalytics size={24} />
            </div>
            <span className="font-semibold text-sm">学習記録</span>
          </button>

          <button
            onClick={() => router.push('/lesson-notes')}
            className="bg-[#6BB6A8] hover:bg-[#5FA084] rounded-2xl p-4 transition-all duration-200 shadow-md flex flex-col items-center justify-center gap-2 text-white"
          >
            <div className="bg-white/20 p-3 rounded-xl">
              <MdEventNote size={24} />
            </div>
            <span className="font-semibold text-sm">授業記録</span>
          </button>
        </div>

        <button
          onClick={() => router.push('/messages')}
          className="w-full mt-3 bg-pink-500 hover:bg-pink-600 rounded-2xl p-4 transition-all duration-200 shadow-lg flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-xl">
              <MdMessage size={24} />
            </div>
            <span className="font-bold">学習サポートルーム</span>
          </div>
          {unreadCount > 0 && (
            <div className="bg-white text-pink-600 text-xs rounded-full px-3 py-1.5 font-bold shadow-md">
              {unreadCount}
            </div>
          )}
        </button>
      </div>
    </div>

    {/* メインエリア */}
    <div className="flex-1">
      <div className="bg-white shadow-xl rounded-2xl p-6 border-l-4 border-[#8DCCB3]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <div className="bg-[#6BB6A8] p-2.5 rounded-xl mr-3 shadow-md">
              <MdEventNote className="text-white" size={20} />
            </div>
            本日の授業予定
          </h3>
          <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
            <div className="text-sm font-medium text-gray-600">
              {new Date().toLocaleDateString('ja-JP', {
                month: 'long',
                day: 'numeric',
                weekday: 'short'
              })}
            </div>
          </div>
        </div>

        {isLoadingSchedules ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-[#8DCCB3]"></div>
          </div>
        ) : todaySchedules.length > 0 ? (
          <div className="space-y-3">
            {todaySchedules.map((schedule, index) => (
              <div
                key={schedule.id}
                className="group hover:scale-[1.01] transition-all duration-200 bg-white hover:bg-gray-50 rounded-xl border border-gray-100 hover:border-[#8DCCB3]/40 shadow-sm hover:shadow-md p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-xl ${
                      schedule.lesson_type === 'face_to_face'
                        ? 'bg-[#6BB6A8]'
                        : 'bg-[#8DCCB3]'
                    }`}>
                      <MdCalendarToday className="text-white" size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-base mb-1">
                        {schedule.start_time} - {schedule.end_time}
                      </div>
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <span className="font-medium">{schedule.subject}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          schedule.lesson_type === 'face_to_face'
                            ? 'bg-[#8DCCB3]/20 text-[#5FA084]'
                            : 'bg-[#B8E0D0]/30 text-[#6BB6A8]'
                        }`}>
                          {schedule.lesson_type === 'face_to_face' ? '対面' : '映像'}
                        </span>
                      </div>
                      {(schedule.student?.full_name || schedule.instructor?.full_name) && (
                        <div className="text-xs text-gray-500 mt-1.5">
                          {profile?.role === 'admin' ? (
                            <>
                              {schedule.student?.full_name && `生徒: ${schedule.student.full_name}`}
                              {schedule.student?.full_name && schedule.instructor?.full_name && ' • '}
                              {schedule.instructor?.full_name && `講師: ${schedule.instructor.full_name}`}
                            </>
                          ) : profile?.role === 'instructor' ? (
                            schedule.student?.full_name && `生徒: ${schedule.student.full_name}`
                          ) : (
                            schedule.instructor?.full_name && `講師: ${schedule.instructor.full_name}`
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-gray-300 group-hover:text-[#8DCCB3] transition-colors text-xl">›</div>
                </div>
              </div>
            ))}
            <button
              onClick={() => router.push('/schedule')}
              className="w-full text-center py-4 bg-[#6BB6A8] hover:bg-[#5FA084] text-white rounded-xl transition-all duration-200 text-sm font-bold shadow-md"
            >
              <div className="flex items-center justify-center space-x-2">
                <MdCalendarToday size={18} />
                <span>全ての予定を表示</span>
              </div>
            </button>
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-200">
            <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MdEventNote className="text-gray-400" size={40} />
            </div>
            <p className="text-gray-700 font-semibold text-lg mb-6">本日の授業予定はありません</p>
            <button
              onClick={() => router.push('/schedule')}
              className="bg-[#6BB6A8] hover:bg-[#5FA084] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
            >
              スケジュール管理へ
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
)}
{profile.role === 'instructor' && (
  <div className="flex flex-col lg:flex-row gap-6">
    {/* 講師サイドバー */}
    <div className="w-full lg:w-80">
      <div className="bg-white shadow-xl rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-2.5 rounded-xl mr-3 shadow-md">
            <MdSupervisorAccount className="text-white" size={20} />
          </div>
          講師メニュー
        </h2>

        <div className="space-y-4">
          {/* 授業カテゴリ */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
              授業
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/schedule')}
                className="w-full bg-white hover:bg-gray-50 rounded-xl p-4 transition-all duration-200 group border border-gray-100 hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center">
                  <div className="bg-[#8DCCB3]/10 p-3 rounded-xl mr-3 group-hover:bg-[#8DCCB3]/20 transition-colors">
                    <MdCalendarToday className="text-[#5FA084]" size={20} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900 text-sm">授業スケジュール</div>
                    <div className="text-xs text-gray-500 mt-0.5">今日の授業予定確認</div>
                  </div>
                  <div className="text-gray-300 group-hover:text-[#8DCCB3] transition-colors text-xl">›</div>
                </div>
              </button>
            </div>
          </div>

          {/* コミュニケーションカテゴリ */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
              コミュニケーション
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/messages')}
                className="w-full bg-gradient-to-br from-pink-50 to-rose-50 hover:from-pink-100 hover:to-rose-100 rounded-xl p-4 transition-all duration-200 group border border-pink-200/50 hover:border-pink-300/60 shadow-md hover:shadow-lg"
              >
                <div className="flex items-center">
                  <div className="bg-gradient-to-br from-pink-400 to-rose-500 p-3 rounded-xl mr-3 shadow-md">
                    <MdMessage className="text-white" size={20} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-bold text-pink-600 text-sm">学習サポートルーム</div>
                    <div className="text-xs text-gray-600 mt-0.5">担当生徒との学習相談</div>
                  </div>
                  {unreadCount > 0 && (
                    <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full px-2.5 py-1 font-bold mr-2 shadow-md">
                      {unreadCount}
                    </div>
                  )}
                  <div className="text-pink-300 group-hover:text-pink-500 transition-colors text-xl">›</div>
                </div>
              </button>
            </div>
          </div>

          {/* 授業記録カテゴリ */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
              授業記録
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/lesson-notes')}
                className="w-full bg-white hover:bg-gray-50 rounded-xl p-4 transition-all duration-200 group border border-gray-100 hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center">
                  <div className="bg-[#8DCCB3]/10 p-3 rounded-xl mr-3 group-hover:bg-[#8DCCB3]/20 transition-colors">
                    <MdEventNote className="text-[#5FA084]" size={20} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900 text-sm">授業記録ノート</div>
                    <div className="text-xs text-gray-500 mt-0.5">授業内容記録・引き継ぎ事項</div>
                  </div>
                  <div className="text-gray-300 group-hover:text-[#8DCCB3] transition-colors text-xl">›</div>
                </div>
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
      <div className="bg-white shadow-xl rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center">
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-2.5 rounded-xl mr-3 shadow-md">
            <MdSchool className="text-white" size={20} />
          </div>
          生徒メニュー
        </h2>

        <div className="space-y-4">
          {/* 学習カテゴリ */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
              学習
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/schedule')}
                className="w-full bg-white hover:bg-gray-50 rounded-xl p-4 transition-all duration-200 group border border-gray-100 hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center">
                  <div className="bg-[#8DCCB3]/10 p-3 rounded-xl mr-3 group-hover:bg-[#8DCCB3]/20 transition-colors">
                    <MdCalendarToday className="text-[#5FA084]" size={20} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900 text-sm">今日の授業</div>
                    <div className="text-xs text-gray-500 mt-0.5">本日の予定を確認</div>
                  </div>
                  <div className="text-gray-300 group-hover:text-[#8DCCB3] transition-colors text-xl">›</div>
                </div>
              </button>

              <button
                onClick={() => router.push('/learning-records')}
                className="w-full bg-white hover:bg-gray-50 rounded-xl p-4 transition-all duration-200 group border border-gray-100 hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center">
                  <div className="bg-[#8DCCB3]/10 p-3 rounded-xl mr-3 group-hover:bg-[#8DCCB3]/20 transition-colors">
                    <MdAnalytics className="text-[#5FA084]" size={20} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900 text-sm">学習記録</div>
                    <div className="text-xs text-gray-500 mt-0.5">学習状況を記録</div>
                  </div>
                  <div className="text-gray-300 group-hover:text-[#8DCCB3] transition-colors text-xl">›</div>
                </div>
              </button>

              <button
                onClick={() => router.push('/my-test-scores')}
                className="w-full bg-white hover:bg-gray-50 rounded-xl p-4 transition-all duration-200 group border border-gray-100 hover:border-[#8DCCB3]/30 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center">
                  <div className="bg-[#8DCCB3]/10 p-3 rounded-xl mr-3 group-hover:bg-[#8DCCB3]/20 transition-colors">
                    <MdTrendingUp className="text-[#5FA084]" size={20} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900 text-sm">マイ成績</div>
                    <div className="text-xs text-gray-500 mt-0.5">テスト結果の入力・確認</div>
                  </div>
                  <div className="text-gray-300 group-hover:text-[#8DCCB3] transition-colors text-xl">›</div>
                </div>
              </button>
            </div>
          </div>

          {/* 映像授業カテゴリ */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
              映像授業
            </h3>
            <div className="space-y-2">
              <div className="bg-gradient-to-br from-[#8DCCB3]/10 to-[#B8E0D0]/20 p-5 rounded-xl border border-[#8DCCB3]/20 shadow-sm">
                <div className="flex items-center justify-center mb-3">
                  <div className="bg-gradient-to-br from-[#8DCCB3] to-[#6BB6A8] p-2 rounded-lg mr-2">
                    <MdPlayCircleOutline className="text-white" size={18} />
                  </div>
                  <h4 className="text-sm font-bold text-gray-800">ブロードバンド予備校</h4>
                </div>
                <div className="flex justify-center mb-3">
                  <div className="bg-white p-2 rounded-xl shadow-md">
                    <img
                      src="/qr_bby.png"
                      alt="ブロードバンド予備校QRコード"
                      className="w-28 h-28 rounded-lg"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-600 text-center leading-relaxed">
                  iPadでQRコードを読み取って<br />
                  映像授業にアクセス
                </p>
              </div>
            </div>
          </div>

          {/* コミュニケーションカテゴリ */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
              コミュニケーション
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/messages')}
                className="w-full bg-gradient-to-br from-pink-50 to-rose-50 hover:from-pink-100 hover:to-rose-100 rounded-xl p-4 transition-all duration-200 group border border-pink-200/50 hover:border-pink-300/60 shadow-md hover:shadow-lg"
              >
                <div className="flex items-center">
                  <div className="bg-gradient-to-br from-pink-400 to-rose-500 p-3 rounded-xl mr-3 shadow-md">
                    <MdMessage className="text-white" size={20} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-bold text-pink-600 text-sm">学習サポートルーム</div>
                    <div className="text-xs text-gray-600 mt-0.5">講師との学習相談</div>
                  </div>
                  {unreadCount > 0 && (
                    <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full px-2.5 py-1 font-bold mr-2 shadow-md">
                      {unreadCount}
                    </div>
                  )}
                  <div className="text-pink-300 group-hover:text-pink-500 transition-colors text-xl">›</div>
                </div>
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