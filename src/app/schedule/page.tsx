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
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [view, setView] = useState(Views.MONTH)
  const [date, setDate] = useState(new Date())
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (profile) {
      fetchSchedules()
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

  // スケジュール作成成功時の処理
  const handleScheduleCreated = () => {
    fetchSchedules() // スケジュール一覧を再取得
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

  // スケジュールデータをカレンダーイベント形式に変換
  const events: CalendarEvent[] = schedules.map((schedule) => {
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
      resource: schedule
    }
  })

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
    
    if (schedule.lesson_type === 'video') {
      backgroundColor = '#10b981' // 映像授業（緑）
    } else if (schedule.lesson_type === 'face_to_face') {
      backgroundColor = '#f59e0b' // 対面授業（オレンジ）
    }

    if (schedule.status === 'completed') {
      backgroundColor = '#6b7280' // 完了（グレー）
    } else if (schedule.status === 'cancelled') {
      backgroundColor = '#ef4444' // キャンセル（赤）
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
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
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <img 
                src="/main_icon.png" 
                alt="ツナグ" 
                className="h-8 w-8"
              />
              <h1 className="text-3xl font-bold text-gray-900">スケジュール</h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* 新規作成ボタン（塾長・講師のみ表示） */}
              {(profile?.role === 'admin' || profile?.role === 'instructor') && (
                <button
                  onClick={handleCreateNew}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  ＋ 新規作成
                </button>
              )}
              <button
                onClick={() => router.push('/dashboard')}
                className="text-blue-600 hover:text-blue-800"
              >
                ダッシュボードに戻る
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
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
              <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
              <span>キャンセル</span>
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
        </div>
      </main>
    </div>
  )
}