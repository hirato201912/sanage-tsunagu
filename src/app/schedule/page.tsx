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
import { notificationService } from '@/lib/notifications'
import { useSaveCurrentPage } from '@/hooks/useSaveCurrentPage'
import LoadingScreen from '@/components/LoadingScreen'

// 編集モーダルコンポーネント
function EditModal({ schedule, recurring, onClose, onUpdate }: {
  schedule: Schedule | null
  recurring: RecurringSchedule | null
  onClose: () => void
  onUpdate: (e: React.FormEvent, formData: any) => void
}) {
  const DAYS_OF_WEEK = [
    { value: 0, label: '日曜日' },
    { value: 1, label: '月曜日' },
    { value: 2, label: '火曜日' },
    { value: 3, label: '水曜日' },
    { value: 4, label: '木曜日' },
    { value: 5, label: '金曜日' },
    { value: 6, label: '土曜日' }
  ]

  const [formData, setFormData] = useState(() => {
    if (schedule) {
      return {
        subject: schedule.subject,
        lesson_type: schedule.lesson_type,
        lesson_date: schedule.lesson_date,
        start_time: schedule.start_time.substring(0, 5), // HH:MM形式に変換
        end_time: schedule.end_time.substring(0, 5), // HH:MM形式に変換
        notes: schedule.notes || ''
      }
    } else if (recurring) {
      return {
        subject: recurring.subject,
        lesson_type: recurring.lesson_type,
        day_of_week: recurring.day_of_week,
        start_time: recurring.start_time.substring(0, 5), // HH:MM形式に変換
        end_time: recurring.end_time.substring(0, 5), // HH:MM形式に変換
        start_date: recurring.start_date,
        end_date: recurring.end_date || '',
        notes: recurring.notes || ''
      }
    }
    return {}
  })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">
              {schedule ? 'スケジュール編集' : '定期スケジュール編集'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={(e) => onUpdate(e, formData)} className="p-6 space-y-4">
          {/* 科目 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">科目 *</label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({...formData, subject: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3]"
            />
          </div>

          {/* 授業タイプ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">授業タイプ *</label>
            <select
              required
              value={formData.lesson_type}
              onChange={(e) => setFormData({...formData, lesson_type: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3]"
            >
              <option value="video">映像授業</option>
              <option value="face_to_face">対面授業</option>
            </select>
          </div>

          {/* 日付または曜日 */}
          {schedule ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日付 *</label>
              <input
                type="date"
                required
                value={formData.lesson_date}
                onChange={(e) => setFormData({...formData, lesson_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3]"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">曜日 *</label>
              <select
                required
                value={formData.day_of_week}
                onChange={(e) => setFormData({...formData, day_of_week: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3]"
              >
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day.value} value={day.value}>{day.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* 開始時間 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始時間 *</label>
            <input
              type="time"
              required
              value={formData.start_time}
              onChange={(e) => setFormData({...formData, start_time: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3]"
            />
          </div>

          {/* 終了時間 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">終了時間 *</label>
            <input
              type="time"
              required
              value={formData.end_time}
              onChange={(e) => setFormData({...formData, end_time: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3]"
            />
          </div>

          {/* 定期スケジュールの場合は開始日・終了日 */}
          {recurring && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始日 *</label>
                <input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">終了日（任意）</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3]"
                />
                <p className="text-xs text-gray-500 mt-1">空白の場合は無期限で継続</p>
              </div>
            </>
          )}

          {/* 備考 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3]"
            />
          </div>

          {/* ボタン */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-[#6BB6A8] text-white rounded-lg hover:bg-[#5FA084] transition-colors font-medium shadow-md"
            >
              更新
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [editingRecurring, setEditingRecurring] = useState<RecurringSchedule | null>(null)

  // リロード時にこのページに戻れるように保存
  useSaveCurrentPage()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (profile) {
      fetchSchedules()
      fetchRecurringSchedules()
      // 通知許可を要求
      if (notificationService.isSupported()) {
        notificationService.requestPermission()
      }
      // リマインダーチェックを開始
      startReminderCheck()
    }
  }, [profile])

  // 授業開始前の通知チェック（15分前と5分前）
  useEffect(() => {
    const interval = setInterval(() => {
      checkUpcomingLessons()
    }, 60000) // 1分ごとにチェック

    return () => clearInterval(interval)
  }, [schedules])

  const checkUpcomingLessons = () => {
    if (!profile || !notificationService.isPermissionGranted()) return

    const now = new Date()
    const nowTime = now.getTime()

    schedules.forEach(schedule => {
      // 今日の授業のみチェック
      const lessonDate = new Date(schedule.lesson_date)
      const lessonStart = new Date(`${schedule.lesson_date}T${schedule.start_time}`)
      
      if (lessonDate.toDateString() !== now.toDateString()) return
      
      const timeDiff = lessonStart.getTime() - nowTime
      const minutesUntil = Math.floor(timeDiff / 60000)

      // 15分前の通知
      if (minutesUntil === 15) {
        notificationService.notifyLessonReminder({
          lessonTitle: `${schedule.subject}の授業`,
          timeUntil: '15分',
          onClick: () => {
            window.focus()
            // カレンダーの今日の表示に移動
            setView(Views.DAY)
            setDate(new Date())
          }
        })
      }

      // 5分前の通知
      if (minutesUntil === 5) {
        notificationService.notifyLessonReminder({
          lessonTitle: `${schedule.subject}の授業`,
          timeUntil: '5分',
          onClick: () => {
            window.focus()
            setView(Views.DAY)
            setDate(new Date())
          }
        })
      }
    })
  }

  const startReminderCheck = () => {
    // 初回チェック
    setTimeout(() => {
      checkUpcomingLessons()
    }, 1000)
  }

  const fetchSchedules = async () => {
    try {
      let query = supabase.from('schedules').select(`
        *,
        student:student_id(id, full_name, role),
        instructor:instructor_id(id, full_name, role)
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
        student:student_id(id, full_name, role),
        instructor:instructor_id(id, full_name, role)
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
        const dateString = currentDate.toISOString().split('T')[0]

        // この日に単発スケジュールが既に存在するかチェック（上書きまたはキャンセル済み）
        const existingSingleSchedule = schedules.find(s =>
          s.lesson_date === dateString &&
          (s as any).recurring_schedule_id === recurringSchedule.id
        )

        // 既に単発スケジュールが存在する場合はスキップ（単発が優先）
        if (!existingSingleSchedule || existingSingleSchedule.status !== 'cancelled') {
          const startDateTime = new Date(`${dateString}T${recurringSchedule.start_time}`)
          const endDateTime = new Date(`${dateString}T${recurringSchedule.end_time}`)

          let title = `${recurringSchedule.subject}（定期）`
          if (profile?.role !== 'student') {
            title += ` - ${(recurringSchedule as any).student?.full_name}`

            // 塾長の場合は作成者情報も表示
            if (profile?.role === 'admin' && recurringSchedule.created_by) {
              // created_byがstudent_idと一致する場合は生徒作成、instructor_idと一致する場合は講師作成、それ以外は塾長作成
              if (recurringSchedule.created_by === recurringSchedule.student_id) {
                title += ' [生徒作成]'
              } else if (recurringSchedule.created_by === recurringSchedule.instructor_id) {
                title += ' [講師作成]'
              } else {
                title += ' [塾長作成]'
              }
            }
          }
          if (profile?.role === 'student') {
            title += ` - ${(recurringSchedule as any).instructor?.full_name || '講師未定'}`
          }

          recurringEvents.push({
            id: `recurring-${recurringSchedule.id}-${dateString}`,
            title,
            start: startDateTime,
            end: endDateTime,
            resource: {
              ...recurringSchedule,
              lesson_date: dateString,
              id: `recurring-${recurringSchedule.id}-${dateString}`,
              status: 'scheduled',
              recurring_schedule_id: recurringSchedule.id,
              isRecurring: true
            } as any
          })
        }

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
      
      // 塾長の場合は作成者情報も表示
      if (profile?.role === 'admin' && schedule.created_by) {
        // created_byがstudent_idと一致する場合は生徒作成、instructor_idと一致する場合は講師作成、それ以外は塾長作成
        if (schedule.created_by === schedule.student_id) {
          title += ' [生徒作成]'
        } else if (schedule.created_by === schedule.instructor_id) {
          title += ' [講師作成]'
        } else {
          title += ' [塾長作成]'
        }
      }
    }
    if (profile?.role === 'student') {
      const instructorName = (schedule as any).instructor?.full_name
      if (schedule.lesson_type === 'video') {
        title += instructorName ? ` - ${instructorName}` : ' - 映像授業'
      } else {
        title += ` - ${instructorName || '講師未定'}`
      }
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
    setSelectedEvent(event)
    setShowDetailModal(true)
  }

  // スケジュール削除
  const handleDeleteSchedule = async (scheduleId: string) => {
    // 定期スケジュールから生成されたイベントの場合は削除不可
    if (scheduleId.toString().startsWith('recurring-')) {
      alert('定期スケジュールから生成されたイベントは個別に削除できません。定期スケジュール一覧から削除してください。')
      return
    }

    if (!confirm('このスケジュールを削除しますか？')) return

    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId)

      if (error) throw error

      setShowDetailModal(false)
      fetchSchedules()
      alert('スケジュールを削除しました')
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('スケジュールの削除に失敗しました')
    }
  }

  // 定期スケジュール削除
  const handleDeleteRecurring = async (recurringId: string) => {
    if (!confirm('この定期スケジュールを削除しますか？')) return

    try {
      const { error } = await supabase
        .from('recurring_schedules')
        .delete()
        .eq('id', recurringId)

      if (error) throw error

      fetchRecurringSchedules()
      alert('定期スケジュールを削除しました')
    } catch (error) {
      console.error('Error deleting recurring schedule:', error)
      alert('定期スケジュールの削除に失敗しました')
    }
  }

  // スケジュール編集開始
  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    setShowDetailModal(false)
    setShowEditModal(true)
  }

  // 定期スケジュールの単発化（この日のみ編集）
  const handleConvertToSingleSchedule = async (schedule: Schedule) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // 単発スケジュールとして新規作成
      const { data, error } = await supabase
        .from('schedules')
        .insert([{
          student_id: schedule.student_id,
          instructor_id: schedule.instructor_id || null,
          lesson_type: schedule.lesson_type,
          subject: schedule.subject,
          lesson_date: schedule.lesson_date,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          status: 'scheduled',
          notes: schedule.notes || null,
          created_by: user?.id,
          recurring_schedule_id: (schedule as any).recurring_schedule_id // 元の定期スケジュールIDを保持
        }])
        .select()

      if (error) throw error

      // 新しく作成された単発スケジュールを編集モードで開く
      if (data && data[0]) {
        setEditingSchedule(data[0] as Schedule)
        setShowDetailModal(false)
        setShowEditModal(true)
        fetchSchedules() // リストを更新
      }
    } catch (error) {
      console.error('Error converting to single schedule:', error)
      alert('単発スケジュールへの変換に失敗しました')
    }
  }

  // 定期スケジュールの単発削除（この日のみ削除）
  const handleDeleteSingleOccurrence = async (schedule: Schedule) => {
    if (!confirm('この日のスケジュールのみを削除しますか？\n（定期スケジュール全体には影響しません）')) return

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // キャンセル済みとして単発スケジュールを作成（削除扱い）
      const { error } = await supabase
        .from('schedules')
        .insert([{
          student_id: schedule.student_id,
          instructor_id: schedule.instructor_id || null,
          lesson_type: schedule.lesson_type,
          subject: schedule.subject,
          lesson_date: schedule.lesson_date,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          status: 'cancelled', // キャンセル済みとして作成
          notes: '定期スケジュールから削除',
          created_by: user?.id,
          recurring_schedule_id: (schedule as any).recurring_schedule_id
        }])

      if (error) throw error

      setShowDetailModal(false)
      fetchSchedules()
      alert('この日のスケジュールを削除しました')
    } catch (error) {
      console.error('Error deleting single occurrence:', error)
      alert('スケジュールの削除に失敗しました')
    }
  }

  // 定期スケジュール編集開始
  const handleEditRecurring = (recurring: RecurringSchedule) => {
    setEditingRecurring(recurring)
    setShowEditModal(true)
  }

  // スケジュール更新
  const handleUpdateSchedule = async (e: React.FormEvent, formData: any) => {
    e.preventDefault()

    try {
      const { error } = await supabase
        .from('schedules')
        .update({
          subject: formData.subject,
          lesson_type: formData.lesson_type,
          lesson_date: formData.lesson_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          notes: formData.notes
        })
        .eq('id', editingSchedule?.id)

      if (error) throw error

      setShowEditModal(false)
      setEditingSchedule(null)
      fetchSchedules()
      alert('スケジュールを更新しました')
    } catch (error) {
      console.error('Error updating schedule:', error)
      alert('スケジュールの更新に失敗しました')
    }
  }

  // 定期スケジュール更新
  const handleUpdateRecurring = async (e: React.FormEvent, formData: any) => {
    e.preventDefault()

    try {
      const { error } = await supabase
        .from('recurring_schedules')
        .update({
          subject: formData.subject,
          lesson_type: formData.lesson_type,
          day_of_week: formData.day_of_week,
          start_time: formData.start_time,
          end_time: formData.end_time,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          notes: formData.notes
        })
        .eq('id', editingRecurring?.id)

      if (error) throw error

      setShowEditModal(false)
      setEditingRecurring(null)
      fetchRecurringSchedules()
      alert('定期スケジュールを更新しました')
    } catch (error) {
      console.error('Error updating recurring schedule:', error)
      alert('定期スケジュールの更新に失敗しました')
    }
  }

  // イベントの色分け
  const eventStyleGetter = (event: CalendarEvent) => {
    const schedule = event.resource
    let backgroundColor = '#3b82f6' // デフォルト（青）

    if (schedule.lesson_type === 'video') {
      backgroundColor = '#10b981' // 映像授業（緑）
    } else if (schedule.lesson_type === 'face_to_face') {
      backgroundColor = '#EC4899' // 対面授業（ピンク）
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    }
  }

  if (loading || scheduleLoading) {
    return <LoadingScreen message="スケジュールを読み込んでいます" />
  }

  if (!user || !profile) {
    return null
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
              <div>
                <h1 className="text-2xl font-bold text-white">スケジュール</h1>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-white hover:bg-gray-100 text-[#5FA084] px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>ダッシュボード</span>
            </button>
          </div>

          {/* アクションボタン行 */}
          {(profile?.role === 'admin' || profile?.role === 'instructor' || profile?.role === 'student') && (
            <div className="border-t border-white/20 py-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* 主要アクション：単発と定期 */}
                <button
                  onClick={handleCreateNew}
                  className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-[#6BB6A8] px-6 py-3 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>単発で追加</span>
                </button>
                {(profile?.role === 'admin' || profile?.role === 'instructor') && (
                  <button
                    onClick={() => setShowRecurringForm(true)}
                    className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-[#6BB6A8] px-6 py-3 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-white"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>定期で追加</span>
                  </button>
                )}

                {/* セカンダリアクション：定期一覧 */}
                {(profile?.role === 'admin' || profile?.role === 'instructor') && (
                  <>
                    <div className="flex-grow"></div>
                    <button
                      onClick={() => setShowRecurringList(!showRecurringList)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                        showRecurringList
                          ? 'bg-white/30 text-white'
                          : 'bg-white/10 hover:bg-white/20 text-white/90'
                      }`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2H9z" />
                      </svg>
                      <span>定期一覧 {showRecurringList ? '▲' : '▼'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 定期スケジュール一覧（トグル表示） */}
          {showRecurringList && (
            <div className="bg-white shadow-xl rounded-2xl p-6 mb-6 border-l-4 border-[#8DCCB3]">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <div className="bg-[#6BB6A8] p-2.5 rounded-xl mr-3 shadow-md">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                定期スケジュール一覧
              </h3>
              {recurringSchedules.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-[#8DCCB3]/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1V8a1 1 0 011-1h3z" />
                  </svg>
                  <p className="text-gray-500">定期スケジュールが登録されていません。</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recurringSchedules.map((schedule) => (
                    <div key={schedule.id} className="flex justify-between items-center p-4 bg-white hover:bg-gray-50 rounded-xl border border-gray-100 hover:border-[#8DCCB3]/40 shadow-sm hover:shadow-md transition-all duration-200">
                      <div className="flex-1">
                        <span className="font-semibold text-gray-900">
                          {formatRecurringSchedule(schedule)}
                        </span>
                        {profile?.role !== 'student' && (
                          <span className="ml-2 text-sm text-gray-600">
                            - {(schedule as any).student?.full_name}
                          </span>
                        )}
                        <div className="text-sm text-[#6BB6A8] font-medium mt-1">
                          {schedule.start_date} 〜 {schedule.end_date || '無期限'}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEditRecurring(schedule)}
                          className="p-2 text-[#6BB6A8] hover:bg-[#6BB6A8]/10 rounded-lg transition-colors"
                          title="編集"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteRecurring(schedule.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="削除"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 凡例 */}
          <div className="mb-6 bg-white rounded-2xl shadow-md p-5 border border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 mb-3">授業タイプ</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-[#10b981] rounded mr-2"></div>
                <span className="text-gray-700">映像授業</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-[#EC4899] rounded mr-2"></div>
                <span className="text-gray-700">対面授業</span>
              </div>
            </div>
          </div>

          {/* カレンダー */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-[#8DCCB3]">
            <style jsx global>{`
              .rbc-toolbar {
                margin-bottom: 20px;
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                align-items: center;
                justify-content: space-between;
              }
              
              .rbc-toolbar button {
                background: white !important;
                color: #4A5568 !important;
                border: 1px solid #E5E7EB !important;
                border-radius: 8px !important;
                padding: 8px 16px !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
              }

              .rbc-toolbar button:hover {
                background: #F3F4F6 !important;
                color: #1F2937 !important;
                border-color: #D1D5DB !important;
                box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1) !important;
              }

              .rbc-toolbar button.rbc-active,
              .rbc-toolbar button:active {
                background: #6BB6A8 !important;
                color: white !important;
                border-color: #5FA084 !important;
                box-shadow: 0 1px 2px 0 rgba(95, 160, 132, 0.2) !important;
              }
              
              .rbc-toolbar-label {
                color: #1F2937 !important;
                font-size: 18px !important;
                font-weight: 700 !important;
                margin: 0 16px !important;
              }
              
              .rbc-btn-group {
                display: flex;
                gap: 4px;
              }
              
              .rbc-btn-group button {
                margin: 0 !important;
              }
              
              .rbc-btn-group button:first-child {
                border-radius: 8px 4px 4px 8px !important;
              }
              
              .rbc-btn-group button:last-child {
                border-radius: 4px 8px 8px 4px !important;
              }
              
              .rbc-btn-group button:only-child {
                border-radius: 8px !important;
              }
              
              @media (max-width: 640px) {
                .rbc-toolbar {
                  flex-direction: column;
                  align-items: stretch;
                  gap: 8px;
                }
                
                .rbc-toolbar-label {
                  text-align: center;
                  order: -1;
                  margin: 0 0 8px 0 !important;
                }
                
                .rbc-btn-group {
                  justify-content: center;
                }
                
                .rbc-toolbar button {
                  padding: 10px 12px !important;
                  font-size: 13px !important;
                }
              }
            `}</style>
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

          {/* 編集モーダル */}
          {showEditModal && (editingSchedule || editingRecurring) && (
            <EditModal
              schedule={editingSchedule}
              recurring={editingRecurring}
              onClose={() => {
                setShowEditModal(false)
                setEditingSchedule(null)
                setEditingRecurring(null)
              }}
              onUpdate={editingSchedule ? handleUpdateSchedule : handleUpdateRecurring}
            />
          )}

          {/* スケジュール詳細モーダル */}
          {showDetailModal && selectedEvent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* モーダルヘッダー */}
                <div className={`p-6 rounded-t-2xl ${
                  selectedEvent.resource.lesson_type === 'video'
                    ? 'bg-[#10b981]'
                    : 'bg-[#EC4899]'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">
                        {selectedEvent.resource.subject}
                      </h3>
                      <p className="text-white/90 text-sm">
                        {selectedEvent.resource.lesson_type === 'video' ? '映像授業' : '対面授業'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* モーダルボディ */}
                <div className="p-6 space-y-4">
                  {/* 日時 */}
                  <div className="flex items-start space-x-3">
                    <div className="bg-gray-100 p-2.5 rounded-lg">
                      <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">日時</p>
                      <p className="text-gray-900 font-semibold">
                        {selectedEvent.resource.lesson_date}
                      </p>
                      <p className="text-gray-700 text-sm mt-0.5">
                        {selectedEvent.resource.start_time.substring(0, 5)} - {selectedEvent.resource.end_time.substring(0, 5)}
                      </p>
                    </div>
                  </div>

                  {/* 生徒情報 */}
                  {profile?.role !== 'student' && (
                    <div className="flex items-start space-x-3">
                      <div className="bg-gray-100 p-2.5 rounded-lg">
                        <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 mb-1">生徒</p>
                        <p className="text-gray-900 font-semibold">
                          {(selectedEvent.resource as any).student?.full_name || '未設定'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 講師情報 */}
                  {profile?.role === 'student' && (
                    <div className="flex items-start space-x-3">
                      <div className="bg-gray-100 p-2.5 rounded-lg">
                        <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 mb-1">講師</p>
                        <p className="text-gray-900 font-semibold">
                          {(selectedEvent.resource as any).instructor?.full_name || '未定'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 作成者情報（塾長のみ表示） */}
                  {profile?.role === 'admin' && selectedEvent.resource.created_by && (
                    <div className="flex items-start space-x-3">
                      <div className="bg-gray-100 p-2.5 rounded-lg">
                        <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 mb-1">作成者</p>
                        <p className="text-gray-900 font-semibold">
                          {selectedEvent.resource.created_by === selectedEvent.resource.student_id
                            ? '生徒'
                            : selectedEvent.resource.created_by === selectedEvent.resource.instructor_id
                            ? '講師'
                            : '塾長'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 備考 */}
                  {selectedEvent.resource.notes && (
                    <div className="flex items-start space-x-3">
                      <div className="bg-gray-100 p-2.5 rounded-lg">
                        <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 mb-1">備考</p>
                        <p className="text-gray-900 whitespace-pre-wrap">
                          {selectedEvent.resource.notes}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* モーダルフッター */}
                <div className="p-6 border-t border-gray-100">
                  {/* 定期スケジュールの場合は選択肢を表示 */}
                  {(selectedEvent.resource as any).isRecurring || selectedEvent.resource.id.toString().startsWith('recurring-') ? (
                    <>
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800 text-center font-medium mb-2">
                          定期スケジュール
                        </p>
                        <p className="text-xs text-blue-600 text-center">
                          この日のみ変更するか、定期スケジュール全体を変更できます
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteSingleOccurrence(selectedEvent.resource)}
                            className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 font-medium py-2.5 rounded-lg transition-colors text-sm"
                          >
                            この日のみ削除
                          </button>
                          <button
                            onClick={() => handleConvertToSingleSchedule(selectedEvent.resource)}
                            className="flex-1 bg-[#8DCCB3] hover:bg-[#6BB6A8] text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                          >
                            この日のみ編集
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setShowDetailModal(false)
                            setShowRecurringList(true)
                          }}
                          className="w-full bg-[#6BB6A8] hover:bg-[#5FA084] text-white font-semibold py-3 rounded-xl transition-colors"
                        >
                          定期スケジュール全体を編集
                        </button>
                      </div>
                      <button
                        onClick={() => setShowDetailModal(false)}
                        className="w-full mt-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-xl transition-colors"
                      >
                        閉じる
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleDeleteSchedule(selectedEvent.resource.id)}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          削除
                        </button>
                        <button
                          onClick={() => handleEditSchedule(selectedEvent.resource)}
                          className="flex-1 bg-[#6BB6A8] hover:bg-[#5FA084] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          編集
                        </button>
                      </div>
                      <button
                        onClick={() => setShowDetailModal(false)}
                        className="w-full mt-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-xl transition-colors"
                      >
                        閉じる
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}