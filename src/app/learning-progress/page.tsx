'use client'

// useSearchParams()を使用するため、動的レンダリングを強制
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { StudentLessonSetting, LearningTask, Profile } from '@/lib/supabase'
import {
  getNextLessonDate,
  getPreviousLessonDate,
  getNextNextLessonDate,
  formatPeriod,
  getDayName,
  formatDateToString
} from '@/lib/dateUtils'
import {
  MdCheckCircle,
  MdCheckCircleOutline,
  MdAddCircle,
  MdCalendarToday,
  MdClose,
  MdEdit,
  MdDelete,
  MdArrowBack,
  MdHistory,
  MdExpandMore,
  MdExpandLess
} from 'react-icons/md'

interface HistoricalPeriod {
  id: string
  targetDate: Date
  targetDateStr: string
  prevLesson: Date
  nextLesson: Date
  nextNextLesson: Date
  beforeTasks: LearningTask[]
  afterTasks: LearningTask[]
  beforeProgress: number
  afterProgress: number
}

function LearningProgressPageContent() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const studentId = searchParams?.get('student')

  const [student, setStudent] = useState<Profile | null>(null)
  const [lessonSetting, setLessonSetting] = useState<StudentLessonSetting | null>(null)
  const [beforeTasks, setBeforeTasks] = useState<LearningTask[]>([])
  const [afterTasks, setAfterTasks] = useState<LearningTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<'before' | 'after'>('after')
  const [editingTask, setEditingTask] = useState<LearningTask | null>(null)

  // 履歴閲覧用
  const [showHistory, setShowHistory] = useState(false)
  const [historicalData, setHistoricalData] = useState<HistoricalPeriod[]>([])
  const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    subject: ''
  })

  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/login')
    } else if (!loading && profile && profile.role === 'student') {
      router.push('/dashboard')
    }
  }, [user, profile, loading, router])

  useEffect(() => {
    if (profile && (profile.role === 'admin' || profile.role === 'instructor')) {
      if (!studentId) {
        alert('生徒が指定されていません')
        router.push('/learning-admin')
        return
      }
      fetchData()
    }
  }, [profile, studentId, router])

  const fetchData = async () => {
    if (!studentId) return

    try {
      setIsLoading(true)

      // 生徒情報を取得
      const { data: studentData, error: studentError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single()

      if (studentError) throw studentError
      setStudent(studentData)

      // 曜日設定を取得
      const { data: setting, error: settingError } = await supabase
        .from('student_lesson_settings')
        .select('*')
        .eq('student_id', studentId)
        .single()

      if (settingError && settingError.code !== 'PGRST116') throw settingError

      if (!setting) {
        setLessonSetting(null)
        setIsLoading(false)
        return
      }

      setLessonSetting(setting)

      // 次回の対面授業日を計算
      const nextLessonDate = getNextLessonDate(setting.day_of_week)
      const targetDateStr = formatDateToString(nextLessonDate)

      // タスクを取得
      const { data: tasks, error: tasksError } = await supabase
        .from('learning_tasks')
        .select('*')
        .eq('student_id', studentId)
        .eq('target_lesson_date', targetDateStr)
        .order('order_index', { ascending: true })

      if (tasksError) throw tasksError

      if (tasks) {
        setBeforeTasks(tasks.filter(t => t.period === 'before'))
        setAfterTasks(tasks.filter(t => t.period === 'after'))
      }
    } catch (error) {
      console.error('データ取得エラー:', error)
      alert('データの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleTaskCompletion = async (task: LearningTask) => {
    try {
      const newCompleted = !task.completed
      const { error } = await supabase
        .from('learning_tasks')
        .update({
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
          completed_by: newCompleted ? profile?.id : null
        })
        .eq('id', task.id)

      if (error) throw error

      await fetchData()
    } catch (error) {
      console.error('タスク更新エラー:', error)
      alert('タスクの更新に失敗しました')
    }
  }

  const handleAddTask = async () => {
    if (!taskFormData.title.trim() || !lessonSetting || !studentId) {
      alert('タスク名を入力してください')
      return
    }

    try {
      const period = selectedPeriod
      const existingTasks = period === 'before' ? beforeTasks : afterTasks
      const maxOrderIndex = existingTasks.length > 0
        ? Math.max(...existingTasks.map(t => t.order_index))
        : -1

      const nextLessonDate = getNextLessonDate(lessonSetting.day_of_week)
      const targetDateStr = formatDateToString(nextLessonDate)

      const { error } = await supabase
        .from('learning_tasks')
        .insert([{
          student_id: studentId,
          target_lesson_date: targetDateStr,
          period: period,
          title: taskFormData.title,
          description: taskFormData.description || null,
          subject: taskFormData.subject || null,
          order_index: maxOrderIndex + 1,
          completed: false,
          created_by: profile?.id
        }])

      if (error) throw error

      setTaskFormData({ title: '', description: '', subject: '' })
      setShowAddTask(false)
      await fetchData()
    } catch (error) {
      console.error('タスク追加エラー:', error)
      alert('タスクの追加に失敗しました')
    }
  }

  const handleEditTask = async () => {
    if (!editingTask || !taskFormData.title.trim()) {
      alert('タスク名を入力してください')
      return
    }

    try {
      const { error } = await supabase
        .from('learning_tasks')
        .update({
          title: taskFormData.title,
          description: taskFormData.description || null,
          subject: taskFormData.subject || null
        })
        .eq('id', editingTask.id)

      if (error) throw error

      setEditingTask(null)
      setTaskFormData({ title: '', description: '', subject: '' })
      await fetchData()
    } catch (error) {
      console.error('タスク編集エラー:', error)
      alert('タスクの編集に失敗しました')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('このタスクを削除しますか？')) return

    try {
      const { error } = await supabase
        .from('learning_tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('タスク削除エラー:', error)
      alert('タスクの削除に失敗しました')
    }
  }

  const openEditModal = (task: LearningTask) => {
    setEditingTask(task)
    setTaskFormData({
      title: task.title,
      description: task.description || '',
      subject: task.subject || ''
    })
  }

  const closeEditModal = () => {
    setEditingTask(null)
    setTaskFormData({ title: '', description: '', subject: '' })
  }

  const calculateProgress = (tasks: LearningTask[]) => {
    if (tasks.length === 0) return 0
    const completed = tasks.filter(t => t.completed).length
    return Math.round((completed / tasks.length) * 100)
  }

  const fetchHistoricalData = async () => {
    if (!lessonSetting || !studentId) return

    try {
      setIsLoadingHistory(true)
      const periods: HistoricalPeriod[] = []

      // 過去8週分の対面授業日を計算
      for (let i = 1; i <= 8; i++) {
        const weeksAgo = new Date()
        weeksAgo.setDate(weeksAgo.getDate() - (i * 7))

        const targetDate = getNextLessonDate(lessonSetting.day_of_week, weeksAgo)
        const targetDateStr = formatDateToString(targetDate)

        // この日付のタスクを取得
        const { data: tasks, error } = await supabase
          .from('learning_tasks')
          .select('*')
          .eq('student_id', studentId)
          .eq('target_lesson_date', targetDateStr)
          .order('order_index', { ascending: true })

        if (error && error.code !== 'PGRST116') {
          console.error('履歴データ取得エラー:', error)
          continue
        }

        const beforeTasksForPeriod = tasks?.filter(t => t.period === 'before') || []
        const afterTasksForPeriod = tasks?.filter(t => t.period === 'after') || []

        // 前回と次回の授業日を計算
        const prevLesson = getPreviousLessonDate(lessonSetting.day_of_week, targetDate)
        const nextNextLesson = getNextNextLessonDate(lessonSetting.day_of_week, targetDate)

        periods.push({
          id: targetDateStr,
          targetDate,
          targetDateStr,
          prevLesson,
          nextLesson: targetDate,
          nextNextLesson,
          beforeTasks: beforeTasksForPeriod,
          afterTasks: afterTasksForPeriod,
          beforeProgress: calculateProgress(beforeTasksForPeriod),
          afterProgress: calculateProgress(afterTasksForPeriod)
        })
      }

      setHistoricalData(periods)
      setShowHistory(true)
    } catch (error) {
      console.error('履歴データ取得エラー:', error)
      alert('履歴データの取得に失敗しました')
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const togglePeriodExpansion = (periodId: string) => {
    setExpandedPeriodId(expandedPeriodId === periodId ? null : periodId)
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  if (!student || !lessonSetting) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 mb-4">
              {!student ? '生徒が見つかりません' : '対面授業の曜日が設定されていません'}
            </p>
            <button
              onClick={() => router.push('/learning-admin')}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-[#6BB6A8] rounded-xl hover:bg-[#5FA084] transition-all duration-200 shadow-md hover:shadow-lg group"
            >
              <MdArrowBack className="text-lg transition-transform group-hover:-translate-x-1 duration-200" />
              曜日設定画面へ戻る
            </button>
          </div>
        </div>
      </div>
    )
  }

  const beforeProgress = calculateProgress(beforeTasks)
  const afterProgress = calculateProgress(afterTasks)

  const nextLesson = getNextLessonDate(lessonSetting.day_of_week)
  const prevLesson = getPreviousLessonDate(lessonSetting.day_of_week)
  const nextNextLesson = getNextNextLessonDate(lessonSetting.day_of_week)

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border-l-4 border-[#8DCCB3]">
          <button
            onClick={() => router.push('/learning-admin')}
            className="inline-flex items-center gap-2 px-4 py-2.5 mb-6 text-sm font-medium text-gray-700 bg-white rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md border border-gray-200 group"
          >
            <MdArrowBack className="text-lg transition-transform group-hover:-translate-x-1 duration-200" />
            曜日設定画面へ戻る
          </button>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                {student.full_name} のタスク管理
              </h1>
              <div className="flex items-center text-gray-600">
                <MdCalendarToday className="mr-2" />
                <span>対面授業: 毎週{getDayName(lessonSetting.day_of_week)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={fetchHistoricalData}
            disabled={isLoadingHistory}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#6BB6A8] rounded-xl hover:bg-[#5FA084] transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdHistory className="text-lg" />
            {isLoadingHistory ? '読み込み中...' : '📅 過去の記録を見る'}
          </button>
        </div>

        {/* これまでの1週間（振り返り） */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border-l-4 border-[#6BB6A8]">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800">これまでの1週間</h2>
            <p className="text-sm text-gray-600">{formatPeriod(prevLesson, nextLesson)}</p>
          </div>

          <div className="relative w-full h-6 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full shadow-inner overflow-hidden mb-4">
            <div
              className={`h-6 rounded-full transition-all duration-500 relative ${
                beforeProgress === 100
                  ? 'bg-gradient-to-r from-[#6BB6A8] via-[#8DCCB3] to-[#6BB6A8] animate-pulse'
                  : 'bg-gradient-to-r from-[#6BB6A8] to-[#8DCCB3]'
              } shadow-lg`}
              style={{ width: `${beforeProgress}%` }}
            >
              {/* シャイン効果 */}
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent rounded-full" />

              {/* パーセンテージ表示 */}
              {beforeProgress > 10 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white drop-shadow-md">
                  {beforeProgress}%
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {beforeTasks.length === 0 ? (
              <div className="col-span-full">
                <p className="text-gray-500 text-center py-8">タスクがありません</p>
              </div>
            ) : (
              beforeTasks.map(task => (
                <div
                  key={task.id}
                  className={`group relative rounded-xl border-2 transition-all duration-300 ${
                    task.completed
                      ? 'bg-gradient-to-br from-[#8DCCB3]/20 to-[#B8E0D0]/30 border-[#8DCCB3]/50 shadow-lg'
                      : 'bg-white border-gray-200 hover:border-[#6BB6A8]/40 hover:shadow-md'
                  }`}
                >
                  {task.completed && (
                    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-[#6BB6A8] to-[#8DCCB3] text-white text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1 animate-bounce">
                      ✨ 達成！
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleTaskCompletion(task)}
                        className="flex-shrink-0 mt-0.5 relative"
                      >
                        {task.completed ? (
                          <div className="relative">
                            <MdCheckCircle className="text-3xl text-[#6BB6A8] animate-pulse" />
                            <div className="absolute inset-0 animate-ping">
                              <MdCheckCircle className="text-3xl text-[#6BB6A8] opacity-75" />
                            </div>
                          </div>
                        ) : (
                          <MdCheckCircleOutline className="text-3xl text-gray-400 hover:text-[#6BB6A8] transition-colors" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-base mb-2 ${task.completed ? 'text-[#5FA084]' : 'text-gray-800'}`}>
                          {task.title}
                        </div>
                        {task.subject && (
                          <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-lg border ${
                            task.completed
                              ? 'bg-[#6BB6A8]/20 text-[#5FA084] border-[#6BB6A8]/40'
                              : 'bg-[#6BB6A8]/10 text-[#5FA084] border-[#6BB6A8]/20'
                          }`}>
                            {task.subject}
                          </span>
                        )}
                        {task.description && (
                          <p className={`text-sm mt-2 line-clamp-2 ${task.completed ? 'text-gray-600' : 'text-gray-600'}`}>{task.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => openEditModal(task)}
                        className="flex-1 text-sm text-gray-600 hover:text-[#6BB6A8] transition-colors flex items-center justify-center gap-1"
                      >
                        <MdEdit className="text-lg" />
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="flex-1 text-sm text-gray-600 hover:text-red-600 transition-colors flex items-center justify-center gap-1"
                      >
                        <MdDelete className="text-lg" />
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => {
              setSelectedPeriod('before')
              setShowAddTask(true)
            }}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-white text-gray-700 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            <MdAddCircle className="text-xl text-[#6BB6A8]" />
            タスクを追加
          </button>
        </div>

        {/* これからの1週間（予定） */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border-l-4 border-[#8DCCB3]">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800">これからの1週間</h2>
            <p className="text-sm text-gray-600">{formatPeriod(nextLesson, nextNextLesson)}</p>
          </div>

          <div className="relative w-full h-6 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full shadow-inner overflow-hidden mb-4">
            <div
              className={`h-6 rounded-full transition-all duration-500 relative ${
                afterProgress === 100
                  ? 'bg-gradient-to-r from-[#8DCCB3] via-[#B8E0D0] to-[#8DCCB3] animate-pulse'
                  : 'bg-gradient-to-r from-[#8DCCB3] to-[#B8E0D0]'
              } shadow-lg`}
              style={{ width: `${afterProgress}%` }}
            >
              {/* シャイン効果 */}
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent rounded-full" />

              {/* パーセンテージ表示 */}
              {afterProgress > 10 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white drop-shadow-md">
                  {afterProgress}%
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {afterTasks.length === 0 ? (
              <div className="col-span-full">
                <p className="text-gray-500 text-center py-8">タスクがありません</p>
              </div>
            ) : (
              afterTasks.map(task => (
                <div
                  key={task.id}
                  className={`group relative rounded-xl border-2 transition-all duration-300 ${
                    task.completed
                      ? 'bg-gradient-to-br from-[#B8E0D0]/40 to-[#8DCCB3]/20 border-[#8DCCB3]/50 shadow-lg'
                      : 'bg-white border-gray-200 hover:border-[#8DCCB3]/40 hover:shadow-md'
                  }`}
                >
                  {task.completed && (
                    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-[#8DCCB3] to-[#B8E0D0] text-white text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1 animate-bounce">
                      ✨ 達成！
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleTaskCompletion(task)}
                        className="flex-shrink-0 mt-0.5 relative"
                      >
                        {task.completed ? (
                          <div className="relative">
                            <MdCheckCircle className="text-3xl text-[#8DCCB3] animate-pulse" />
                            <div className="absolute inset-0 animate-ping">
                              <MdCheckCircle className="text-3xl text-[#8DCCB3] opacity-75" />
                            </div>
                          </div>
                        ) : (
                          <MdCheckCircleOutline className="text-3xl text-gray-400 hover:text-[#8DCCB3] transition-colors" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-base mb-2 ${task.completed ? 'text-[#5FA084]' : 'text-gray-800'}`}>
                          {task.title}
                        </div>
                        {task.subject && (
                          <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-lg border ${
                            task.completed
                              ? 'bg-[#8DCCB3]/20 text-[#5FA084] border-[#8DCCB3]/40'
                              : 'bg-[#8DCCB3]/10 text-[#5FA084] border-[#8DCCB3]/20'
                          }`}>
                            {task.subject}
                          </span>
                        )}
                        {task.description && (
                          <p className={`text-sm mt-2 line-clamp-2 ${task.completed ? 'text-gray-600' : 'text-gray-600'}`}>{task.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => openEditModal(task)}
                        className="flex-1 text-sm text-gray-600 hover:text-[#8DCCB3] transition-colors flex items-center justify-center gap-1"
                      >
                        <MdEdit className="text-lg" />
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="flex-1 text-sm text-gray-600 hover:text-red-600 transition-colors flex items-center justify-center gap-1"
                      >
                        <MdDelete className="text-lg" />
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => {
              setSelectedPeriod('after')
              setShowAddTask(true)
            }}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-white text-gray-700 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            <MdAddCircle className="text-xl text-[#8DCCB3]" />
            タスクを追加
          </button>
        </div>

        {/* タスク追加モーダル */}
        {showAddTask && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">タスクを追加</h3>
                <button onClick={() => setShowAddTask(false)}>
                  <MdClose className="text-2xl text-gray-400 hover:text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">タスク名 *</label>
                  <input
                    type="text"
                    value={taskFormData.title}
                    onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 outline-none"
                    placeholder="例: 数学の宿題を終わらせる"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">科目（任意）</label>
                  <select
                    value={taskFormData.subject}
                    onChange={(e) => setTaskFormData({ ...taskFormData, subject: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6BB6A8] focus:border-[#6BB6A8] transition-all duration-200 outline-none bg-white"
                  >
                    <option value="">選択してください</option>
                    <optgroup label="国語">
                      <option value="現代文">現代文</option>
                      <option value="古文">古文</option>
                      <option value="漢文">漢文</option>
                    </optgroup>
                    <optgroup label="数学">
                      <option value="数学I">数学I</option>
                      <option value="数学II">数学II</option>
                      <option value="数学III">数学III</option>
                      <option value="数学A">数学A</option>
                      <option value="数学B">数学B</option>
                      <option value="数学C">数学C</option>
                    </optgroup>
                    <optgroup label="英語">
                      <option value="英語コミュニケーション">英語コミュニケーション</option>
                      <option value="論理・表現">論理・表現</option>
                      <option value="英語">英語</option>
                    </optgroup>
                    <optgroup label="理科">
                      <option value="物理">物理</option>
                      <option value="化学">化学</option>
                      <option value="生物">生物</option>
                      <option value="地学">地学</option>
                    </optgroup>
                    <optgroup label="地歴・公民">
                      <option value="日本史">日本史</option>
                      <option value="世界史">世界史</option>
                      <option value="地理">地理</option>
                      <option value="公共">公共</option>
                      <option value="政治・経済">政治・経済</option>
                      <option value="倫理">倫理</option>
                    </optgroup>
                    <optgroup label="その他">
                      <option value="情報">情報</option>
                      <option value="小論文">小論文</option>
                      <option value="その他">その他</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">詳細（任意）</label>
                  <textarea
                    value={taskFormData.description}
                    onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 outline-none resize-none"
                    rows={3}
                    placeholder="タスクの詳細を入力..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleAddTask}
                    className="flex-1 bg-[#6BB6A8] text-white px-4 py-3 rounded-xl hover:bg-[#5FA084] transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                  >
                    追加
                  </button>
                  <button
                    onClick={() => setShowAddTask(false)}
                    className="flex-1 bg-white text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium border border-gray-300"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* タスク編集モーダル */}
        {editingTask && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">タスクを編集</h3>
                <button onClick={closeEditModal}>
                  <MdClose className="text-2xl text-gray-400 hover:text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">タスク名 *</label>
                  <input
                    type="text"
                    value={taskFormData.title}
                    onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">科目（任意）</label>
                  <select
                    value={taskFormData.subject}
                    onChange={(e) => setTaskFormData({ ...taskFormData, subject: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6BB6A8] focus:border-[#6BB6A8] transition-all duration-200 outline-none bg-white"
                  >
                    <option value="">選択してください</option>
                    <optgroup label="国語">
                      <option value="現代文">現代文</option>
                      <option value="古文">古文</option>
                      <option value="漢文">漢文</option>
                    </optgroup>
                    <optgroup label="数学">
                      <option value="数学I">数学I</option>
                      <option value="数学II">数学II</option>
                      <option value="数学III">数学III</option>
                      <option value="数学A">数学A</option>
                      <option value="数学B">数学B</option>
                      <option value="数学C">数学C</option>
                    </optgroup>
                    <optgroup label="英語">
                      <option value="英語コミュニケーション">英語コミュニケーション</option>
                      <option value="論理・表現">論理・表現</option>
                      <option value="英語">英語</option>
                    </optgroup>
                    <optgroup label="理科">
                      <option value="物理">物理</option>
                      <option value="化学">化学</option>
                      <option value="生物">生物</option>
                      <option value="地学">地学</option>
                    </optgroup>
                    <optgroup label="地歴・公民">
                      <option value="日本史">日本史</option>
                      <option value="世界史">世界史</option>
                      <option value="地理">地理</option>
                      <option value="公共">公共</option>
                      <option value="政治・経済">政治・経済</option>
                      <option value="倫理">倫理</option>
                    </optgroup>
                    <optgroup label="その他">
                      <option value="情報">情報</option>
                      <option value="小論文">小論文</option>
                      <option value="その他">その他</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">詳細（任意）</label>
                  <textarea
                    value={taskFormData.description}
                    onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 outline-none resize-none"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleEditTask}
                    className="flex-1 bg-[#6BB6A8] text-white px-4 py-3 rounded-xl hover:bg-[#5FA084] transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                  >
                    保存
                  </button>
                  <button
                    onClick={closeEditModal}
                    className="flex-1 bg-white text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium border border-gray-300"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 過去の記録モーダル */}
        {showHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
              {/* モーダルヘッダー */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#6BB6A8] to-[#8DCCB3]">
                <div className="flex items-center gap-3">
                  <MdHistory className="text-3xl text-white" />
                  <h3 className="text-2xl font-bold text-white">{student?.full_name} の過去の学習記録</h3>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
                  <MdClose className="text-2xl" />
                </button>
              </div>

              {/* モーダルコンテンツ */}
              <div className="overflow-y-auto p-6 flex-1">
                {historicalData.length === 0 ? (
                  <div className="text-center py-12">
                    <MdCalendarToday className="mx-auto text-6xl text-gray-300 mb-4" />
                    <p className="text-gray-600">過去の記録がありません</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historicalData.map((period) => (
                      <div
                        key={period.id}
                        className="bg-white rounded-xl border-2 border-gray-200 hover:border-[#6BB6A8]/40 transition-all duration-200 overflow-hidden"
                      >
                        {/* 期間サマリー */}
                        <button
                          onClick={() => togglePeriodExpansion(period.id)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-3 mb-2">
                              <MdCalendarToday className="text-[#6BB6A8] text-xl" />
                              <span className="font-bold text-gray-800">
                                {formatPeriod(period.prevLesson, period.nextNextLesson)}
                              </span>
                            </div>

                            {/* ミニ進捗バー */}
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <div className="text-xs text-gray-600 mb-1">これまでの1週間</div>
                                <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-3 rounded-full bg-gradient-to-r from-[#6BB6A8] to-[#8DCCB3] transition-all duration-300"
                                    style={{ width: `${period.beforeProgress}%` }}
                                  />
                                  {period.beforeProgress > 0 && (
                                    <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold text-white drop-shadow">
                                      {period.beforeProgress}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="text-xs text-gray-600 mb-1">これからの1週間</div>
                                <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-3 rounded-full bg-gradient-to-r from-[#8DCCB3] to-[#B8E0D0] transition-all duration-300"
                                    style={{ width: `${period.afterProgress}%` }}
                                  />
                                  {period.afterProgress > 0 && (
                                    <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold text-white drop-shadow">
                                      {period.afterProgress}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="ml-4">
                            {expandedPeriodId === period.id ? (
                              <MdExpandLess className="text-2xl text-gray-400" />
                            ) : (
                              <MdExpandMore className="text-2xl text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* 展開コンテンツ */}
                        {expandedPeriodId === period.id && (
                          <div className="border-t border-gray-200 bg-gray-50 p-4">
                            {/* これまでの1週間のタスク */}
                            <div className="mb-6">
                              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <span className="w-1 h-5 bg-[#6BB6A8] rounded"></span>
                                これまでの1週間
                              </h4>
                              {period.beforeTasks.length === 0 ? (
                                <p className="text-sm text-gray-500 pl-3">タスクがありません</p>
                              ) : (
                                <div className="space-y-2">
                                  {period.beforeTasks.map((task) => (
                                    <div
                                      key={task.id}
                                      className={`flex items-start gap-3 p-3 rounded-lg ${
                                        task.completed ? 'bg-[#8DCCB3]/10' : 'bg-white'
                                      }`}
                                    >
                                      {task.completed ? (
                                        <MdCheckCircle className="text-xl text-[#6BB6A8] flex-shrink-0 mt-0.5" />
                                      ) : (
                                        <MdCheckCircleOutline className="text-xl text-gray-400 flex-shrink-0 mt-0.5" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-medium ${task.completed ? 'text-[#5FA084]' : 'text-gray-800'}`}>
                                          {task.title}
                                        </div>
                                        {task.subject && (
                                          <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-md bg-[#6BB6A8]/20 text-[#5FA084]">
                                            {task.subject}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* これからの1週間のタスク */}
                            <div>
                              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <span className="w-1 h-5 bg-[#8DCCB3] rounded"></span>
                                これからの1週間
                              </h4>
                              {period.afterTasks.length === 0 ? (
                                <p className="text-sm text-gray-500 pl-3">タスクがありません</p>
                              ) : (
                                <div className="space-y-2">
                                  {period.afterTasks.map((task) => (
                                    <div
                                      key={task.id}
                                      className={`flex items-start gap-3 p-3 rounded-lg ${
                                        task.completed ? 'bg-[#B8E0D0]/20' : 'bg-white'
                                      }`}
                                    >
                                      {task.completed ? (
                                        <MdCheckCircle className="text-xl text-[#8DCCB3] flex-shrink-0 mt-0.5" />
                                      ) : (
                                        <MdCheckCircleOutline className="text-xl text-gray-400 flex-shrink-0 mt-0.5" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-medium ${task.completed ? 'text-[#5FA084]' : 'text-gray-800'}`}>
                                          {task.title}
                                        </div>
                                        {task.subject && (
                                          <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-md bg-[#8DCCB3]/20 text-[#5FA084]">
                                            {task.subject}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LearningProgressPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    }>
      <LearningProgressPageContent />
    </Suspense>
  )
}
