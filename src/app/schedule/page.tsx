'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Schedule } from '@/lib/supabase'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/ja'
import ScheduleForm from '@/components/ScheduleForm'
import RecurringScheduleForm from '@/components/RecurringScheduleForm'
import { formatRecurringSchedule } from '@/lib/schedule-utils'
import type { RecurringSchedule } from '@/lib/supabase'

// 日本語設定
moment.locale('ja')
const localizer = momentLocalizer(moment)

// カレンダーの日本語メッセージ
const messages = {
  allDay: '終日',
  previous: '前',
  next: '次',
  today: '今日',
  month: '月',
  week: '週',
  day: '日',
  agenda: '予定',
  date: '日付',
  time: '時間',
  event: 'イベント',
  noEventsInRange: 'この期間にイベントはありません',
  showMore: (total: number) => `他 ${total} 件`
}

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: Schedule
}

export default function SchedulePage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringSchedule[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [view, setView] = useState(Views.MONTH)
  const [date, setDate] = useState(new Date())
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [showRecurringList, setShowRecurringList] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (profile) {
      fetchSchedules()
      fetchRecurringSchedules()
    }
  }, [profile])

  const fetchSchedules = async () => {
    try {
      let query = supabase.from('schedules').select(`
        *,
        student:student_id(full_name),
        instructor:instructor_id(full_name)
      `)

      // 役割別のフィルタリング
      if (profile?.role === 'student') {
        query = query.eq('student_id', profile.id)
      } else if (profile?.role === 'instructor') {
        query = query.eq('instructor_id', profile.id)
      }

      const { data, error } = await query.order('lesson_date', { ascending: true })

      if (error) throw error
      setSchedules(data || [])
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setScheduleLoading(false)
    }
  }

  const fetchRecurringSchedules = async () => {
    try {
      let query = supabase.from('recurring_schedules').select(`
        *,
        student:student_id(full_name),
        instructor:instructor_id(full_name)
      `)

      // 役割別のフィルタリング
      if (profile?.role === 'student') {
        query = query.eq('student_id', profile.id)
      } else if (profile?.role === 'instructor') {
        query = query.eq('instructor_id', profile.id)
      }

      const { data, error } = await query.eq('is_active', true).order('day_of_week')

      if (error) throw error
      setRecurringSchedules(data || [])
    } catch (error) {
      console.error('Error fetching recurring schedules:', error)
    }
  }

  // スケジュール作成成功時の処理
  const handleScheduleCreated = () => {
    fetchSchedules() // スケジュール一覧を再取得
  }

  // 定期スケジュール作成成功時の処理
  const handleRecurringScheduleCreated = () => {
    fetchRecurringSchedules()
  }


  // カレンダーの空きスロットクリック時の処理
  const handleSelectSlot = ({ start }: { start: Date; end: Date }) => {
    // 塾長・講師のみスケジュール作成可能
    if (profile?.role === 'admin' || profile?.role === 'instructor') {
      setSelectedDate(start)
      setShowCreateForm(true)
    }
  }

  // 新規作成ボタンクリック時の処理
  const handleCreateNew = () => {
    setSelectedDate(new Date())
    setShowCreateForm(true)
  }

  // 定期スケジュールから現在の表示期間のイベントを生成
  const generateRecurringEvents = (viewStart: Date, viewEnd: Date): CalendarEvent[] => {
    const recurringEvents: CalendarEvent[] = []
    
    recurringSchedules.forEach((recurringSchedule) => {
      const startDate = new Date(Math.max(
        new Date(recurringSchedule.start_date).getTime(),
        viewStart.getTime()
      ))
      
      const endDate = recurringSchedule.end_date 
        ? new Date(Math.min(
            new Date(recurringSchedule.end_date).getTime(),
            viewEnd.getTime()
          ))
        : viewEnd

      let currentDate = new Date(startDate)
      const targetDayOfWeek = recurringSchedule.day_of_week
      
      // 最初の該当曜日まで進める
      while (currentDate.getDay() !== targetDayOfWeek && currentDate <= endDate) {
        currentDate.setDate(currentDate.getDate() + 1)
      }

      // 終了日まで毎週該当曜日のイベントを生成
      while (currentDate <= endDate) {
        const startDateTime = new Date(`${currentDate.toISOString().split('T')[0]}T${recurringSchedule.start_time}`)
        const endDateTime = new Date(`${currentDate.toISOString().split('T')[0]}T${recurringSchedule.end_time}`)
        
        let title = `${recurringSchedule.subject}（定期）`
        if (profile?.role !== 'student') {
          title += ` - ${(recurringSchedule as any).student?.full_name}`
        }
        if (profile?.role === 'student') {
          title += ` - ${(recurringSchedule as any).instructor?.full_name || '講師未定'}`
        }

        recurringEvents.push({
          id: `recurring-${recurringSchedule.id}-${currentDate.toISOString().split('T')[0]}`,
          title,
          start: startDateTime,
          end: endDateTime,
          resource: {
            ...recurringSchedule,
            lesson_date: currentDate.toISOString().split('T')[0],
            id: `recurring-${recurringSchedule.id}-${currentDate.toISOString().split('T')[0]}`,
            status: 'scheduled',
            recurring_schedule_id: recurringSchedule.id,
            isRecurring: true
          } as any
        })

        // 次の週の同じ曜日に進める
        currentDate.setDate(currentDate.getDate() + 7)
      }
    })
    
    return recurringEvents
  }

  // 現在の表示期間を計算
  const getViewRange = () => {
    const start = new Date(date)
    const end = new Date(date)
    
    if (view === Views.MONTH) {
      start.setDate(1)
      start.setDate(start.getDate() - start.getDay()) // 月初の週の日曜日
      end.setMonth(end.getMonth() + 1, 0)
      end.setDate(end.getDate() + (6 - end.getDay())) // 月末の週の土曜日
    } else if (view === Views.WEEK) {
      start.setDate(start.getDate() - start.getDay()) // 週の日曜日
      end.setDate(start.getDate() + 6) // 週の土曜日
    } else {
      // DAY view の場合
      end.setDate(start.getDate())
    }
    
    return { start, end }
  }

  // スケジュールデータをカレンダーイベント形式に変換
  const events: CalendarEvent[] = [
    // 個別スケジュール（キャンセル済みは除外）
    ...schedules
      .filter(schedule => schedule.status !== 'cancelled')
      .map((schedule) => {
    const startDateTime = new Date(`${schedule.lesson_date}T${schedule.start_time}`)
    const endDateTime = new Date(`${schedule.lesson_date}T${schedule.end_time}`)
    
    let title = `${schedule.subject}`
    if (profile?.role !== 'student') {
      title += ` - ${(schedule as any).student?.full_name}`
    }
    if (profile?.role === 'student') {
      title += ` - ${(schedule as any).instructor?.full_name || '講師未定'}`
    }

      return {
        id: schedule.id,
        title,
        start: startDateTime,
        end: endDateTime,
        resource: { ...schedule, isRecurring: false }
      }
    }),
    // 定期スケジュール（現在の表示期間）
    ...generateRecurringEvents(...Object.values(getViewRange()))
  ]

  // イベントクリック時の処理
  const handleSelectEvent = (event: CalendarEvent) => {
    const schedule = event.resource
    alert(`
科目: ${schedule.subject}
種類: ${schedule.lesson_type === 'video' ? '映像授業' : '対面授業'}
日時: ${schedule.lesson_date} ${schedule.start_time} - ${schedule.end_time}
${schedule.notes ? `備考: ${schedule.notes}` : ''}
    `)
  }

  // イベントの色分け
  const eventStyleGetter = (event: CalendarEvent) => {
    const schedule = event.resource
    let backgroundColor = '#3b82f6' // デフォルト（青）
    let borderColor = 'transparent'
    let opacity = 0.8
    
    // 定期スケジュールの場合は境界線を追加して区別
    if ((schedule as any).isRecurring) {
      borderColor = '#4f46e5'
      opacity = 0.7
    }
    
    if (schedule.lesson_type === 'video') {
      backgroundColor = '#10b981' // 映像授業（緑）
    } else if (schedule.lesson_type === 'face_to_face') {
      backgroundColor = '#f59e0b' // 対面授業（オレンジ）
    }

    if (schedule.status === 'completed') {
      backgroundColor = '#6b7280' // 完了（グレー）
    }
    // キャンセルされた授業は表示しない（削除扱い）

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity,
        color: 'white',
        border: (schedule as any).isRecurring ? `2px solid ${borderColor}` : '0px',
        display: 'block'
      }
    }
  }

  if (loading || scheduleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>読み込み中...</div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* メインヘッダー */}
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <img 
                src="/main_icon.png" 
                alt="ツナグ" 
                className="h-12 w-12"
              />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">スケジュール</h1>
                <p className="text-sm text-gray-600 mt-1">授業予定の確認・管理</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm font-medium">ダッシュボード</span>
              </button>
            </div>
          </div>

          {/* アクションボタン行（塾長・講師のみ表示） */}
          {(profile?.role === 'admin' || profile?.role === 'instructor') && (
            <div className="border-t border-gray-200 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleCreateNew}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all hover:shadow-md"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>単発予約</span>
                  </button>
                  <button
                    onClick={() => setShowRecurringForm(true)}
                    className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all hover:shadow-md"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>定期スケジュール</span>
                  </button>
                </div>
                <div className="border-l border-gray-300 h-8 mx-2"></div>
                <button
                  onClick={() => setShowRecurringList(!showRecurringList)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    showRecurringList 
                      ? 'bg-gray-800 text-white shadow-md' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:shadow-sm'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2H9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                  </svg>
                  <span>定期一覧 {showRecurringList ? '非表示' : '表示'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 定期スケジュール一覧（トグル表示） */}
          {showRecurringList && (
            <div className="bg-white shadow rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium mb-4">定期スケジュール一覧</h3>
              {recurringSchedules.length === 0 ? (
                <p className="text-gray-500">定期スケジュールが登録されていません。</p>
              ) : (
                <div className="space-y-2">
                  {recurringSchedules.map((schedule) => (
                    <div key={schedule.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">
                          {formatRecurringSchedule(schedule)}
                        </span>
                        {profile?.role !== 'student' && (
                          <span className="ml-2 text-sm text-gray-600">
                            - {(schedule as any).student?.full_name}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {schedule.start_date} 〜 {schedule.end_date || '無期限'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 凡例 */}
          <div className="mb-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
              <span>映像授業</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-yellow-500 rounded mr-2"></div>
              <span>対面授業</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-500 rounded mr-2"></div>
              <span>完了</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 border-2 border-indigo-600 rounded mr-2"></div>
              <span>定期スケジュール</span>
            </div>
          </div>

          {/* カレンダー */}
          <div className="bg-white rounded-lg shadow p-4">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable={profile?.role === 'admin' || profile?.role === 'instructor'}
              eventPropGetter={eventStyleGetter}
              messages={messages}
              formats={{
                monthHeaderFormat: 'YYYY年M月',
                dayHeaderFormat: 'M/D(ddd)',
                dayRangeHeaderFormat: ({ start, end }) => 
                  `${moment(start).format('M/D')} - ${moment(end).format('M/D')}`,
              }}
            />
          </div>

          {/* スケジュール作成フォーム */}
          <ScheduleForm
            isOpen={showCreateForm}
            onClose={() => setShowCreateForm(false)}
            onSuccess={handleScheduleCreated}
            initialDate={selectedDate}
          />

          {/* 定期スケジュール作成フォーム */}
          <RecurringScheduleForm
            isOpen={showRecurringForm}
            onClose={() => setShowRecurringForm(false)}
            onSuccess={handleRecurringScheduleCreated}
          />
        </div>
      </main>
    </div>
  )
}