'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { StudentLessonSetting, Profile } from '@/lib/supabase'
import { getDayName, getNextLessonDate, formatDateToJapanese } from '@/lib/dateUtils'
import {
  MdCalendarToday,
  MdAddCircle,
  MdClose,
  MdEdit,
  MdDelete,
  MdPerson,
  MdAssignment,
  MdArrowBack
} from 'react-icons/md'

interface StudentWithSetting {
  student: Profile
  setting: StudentLessonSetting | null
}

export default function LearningAdminPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  const [students, setStudents] = useState<Profile[]>([])
  const [settings, setSettings] = useState<StudentLessonSetting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Profile | null>(null)
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(1) // デフォルト: 月曜日

  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/login')
    } else if (!loading && profile && profile.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, profile, loading, router])

  useEffect(() => {
    if (profile && profile.role === 'admin') {
      fetchData()
    }
  }, [profile])

  const fetchData = async () => {
    try {
      setIsLoading(true)

      // 全生徒を取得
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('full_name')

      if (studentsError) throw studentsError

      // 全曜日設定を取得
      const { data: settingsData, error: settingsError } = await supabase
        .from('student_lesson_settings')
        .select('*')

      if (settingsError) throw settingsError

      setStudents(studentsData || [])
      setSettings(settingsData || [])
    } catch (error) {
      console.error('データ取得エラー:', error)
      alert('データの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSetting = async () => {
    if (!editingStudent) return

    try {
      const existingSetting = settings.find(s => s.student_id === editingStudent.id)

      if (existingSetting) {
        // 更新
        const { error } = await supabase
          .from('student_lesson_settings')
          .update({ day_of_week: selectedDayOfWeek })
          .eq('student_id', editingStudent.id)

        if (error) throw error
      } else {
        // 新規作成
        const { error } = await supabase
          .from('student_lesson_settings')
          .insert([{
            student_id: editingStudent.id,
            day_of_week: selectedDayOfWeek,
            created_by: profile?.id
          }])

        if (error) throw error
      }

      setShowModal(false)
      setEditingStudent(null)
      await fetchData()
    } catch (error) {
      console.error('設定保存エラー:', error)
      alert('設定の保存に失敗しました')
    }
  }

  const handleDeleteSetting = async (studentId: string) => {
    if (!confirm('この曜日設定を削除しますか？関連するタスクも全て削除されます。')) return

    try {
      const { error } = await supabase
        .from('student_lesson_settings')
        .delete()
        .eq('student_id', studentId)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('設定削除エラー:', error)
      alert('設定の削除に失敗しました')
    }
  }

  const openModal = (student: Profile) => {
    const existingSetting = settings.find(s => s.student_id === student.id)
    setEditingStudent(student)
    setSelectedDayOfWeek(existingSetting?.day_of_week ?? 1)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingStudent(null)
  }

  const goToTaskManagement = (studentId: string) => {
    router.push(`/learning-progress?student=${studentId}`)
  }

  // 生徒と設定を統合
  const studentsWithSettings: StudentWithSetting[] = students.map(student => ({
    student,
    setting: settings.find(s => s.student_id === student.id) || null
  }))

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border-l-4 border-[#8DCCB3]">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 px-4 py-2.5 mb-6 text-sm font-medium text-gray-700 bg-white rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md border border-gray-200 group"
          >
            <MdArrowBack className="text-lg transition-transform group-hover:-translate-x-1 duration-200" />
            ダッシュボードへ戻る
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">対面授業曜日の設定</h1>
              <p className="text-gray-600">生徒ごとの対面授業の曜日を設定・管理します</p>
            </div>
          </div>
        </div>

        {/* 生徒別の設定一覧 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studentsWithSettings.length === 0 ? (
            <div className="col-span-full bg-white rounded-lg shadow-md p-8 text-center">
              <MdPerson className="mx-auto text-6xl text-gray-300 mb-4" />
              <p className="text-gray-600">生徒が登録されていません</p>
            </div>
          ) : (
            studentsWithSettings.map(({ student, setting }) => (
              <div key={student.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <MdPerson className="text-3xl text-blue-600" />
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">{student.full_name}</h2>
                    </div>
                  </div>
                </div>

                {setting ? (
                  <div className="space-y-3">
                    <div className="bg-[#8DCCB3]/10 rounded-xl p-3 border-2 border-[#8DCCB3]/30">
                      <div className="flex items-center gap-2 mb-2">
                        <MdCalendarToday className="text-[#6BB6A8]" />
                        <span className="font-semibold text-[#5FA084]">対面授業</span>
                      </div>
                      <div className="text-2xl font-bold text-[#6BB6A8] mb-1">
                        {getDayName(setting.day_of_week)}
                      </div>
                      <div className="text-sm text-gray-600">
                        次回: {formatDateToJapanese(getNextLessonDate(setting.day_of_week))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => goToTaskManagement(student.id)}
                        className="flex-1 px-3 py-2.5 bg-[#6BB6A8] text-white rounded-xl hover:bg-[#5FA084] transition-all duration-200 text-sm font-medium flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md"
                      >
                        <MdAssignment className="text-lg" />
                        タスク管理
                      </button>
                      <button
                        onClick={() => openModal(student)}
                        className="px-3 py-2.5 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 border border-gray-200"
                      >
                        <MdEdit className="text-lg" />
                      </button>
                      <button
                        onClick={() => handleDeleteSetting(student.id)}
                        className="px-3 py-2.5 bg-white text-gray-700 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all duration-200 border border-gray-200 hover:border-red-200"
                      >
                        <MdDelete className="text-lg" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-4 text-center border-2 border-dashed border-gray-300">
                      <p className="text-gray-500 text-sm mb-3">曜日が設定されていません</p>
                      <button
                        onClick={() => openModal(student)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6BB6A8] text-white rounded-xl hover:bg-[#5FA084] transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                      >
                        <MdAddCircle className="text-lg" />
                        曜日を設定
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 曜日設定モーダル */}
        {showModal && editingStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">対面授業の曜日を設定</h3>
                <button onClick={closeModal}>
                  <MdClose className="text-2xl text-gray-400 hover:text-gray-600" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-gray-600 mb-1">生徒</p>
                <p className="font-semibold text-lg">{editingStudent.full_name}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    対面授業の曜日 *
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {[0, 1, 2, 3, 4, 5, 6].map(day => (
                      <button
                        key={day}
                        onClick={() => setSelectedDayOfWeek(day)}
                        className={`py-3 rounded-lg font-semibold transition ${
                          selectedDayOfWeek === day
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {['日', '月', '火', '水', '木', '金', '土'][day]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#8DCCB3]/10 rounded-xl p-4 border border-[#8DCCB3]/30">
                  <p className="text-sm text-gray-700 mb-1">設定後の次回対面授業</p>
                  <p className="text-lg font-bold text-[#6BB6A8]">
                    {formatDateToJapanese(getNextLessonDate(selectedDayOfWeek))}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSaveSetting}
                    className="flex-1 bg-[#6BB6A8] text-white px-4 py-3 rounded-xl hover:bg-[#5FA084] transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                  >
                    保存
                  </button>
                  <button
                    onClick={closeModal}
                    className="flex-1 bg-white text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium border border-gray-300"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
