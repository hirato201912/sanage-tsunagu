'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile } from '@/lib/supabase'

interface RecurringScheduleFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: '日曜日' },
  { value: 1, label: '月曜日' },
  { value: 2, label: '火曜日' },
  { value: 3, label: '水曜日' },
  { value: 4, label: '木曜日' },
  { value: 5, label: '金曜日' },
  { value: 6, label: '土曜日' }
]

export default function RecurringScheduleForm({ isOpen, onClose, onSuccess }: RecurringScheduleFormProps) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [students, setStudents] = useState<Profile[]>([])
  const [instructors, setInstructors] = useState<Profile[]>([])

  const [formData, setFormData] = useState({
    student_id: '',
    instructor_id: profile?.role === 'instructor' ? profile.id : '',
    lesson_type: 'video' as 'video' | 'face_to_face',
    subject: '',
    day_of_week: 1, // デフォルトは月曜日
    start_time: '14:00',
    end_time: '15:30',
    start_date: '',
    end_date: '',
    notes: ''
  })

  // 日付の初期化をuseEffectで行う（クライアントサイドのみ）
  useEffect(() => {
    if (typeof window !== 'undefined' && !formData.start_date) {
      const today = new Date().toISOString().split('T')[0]
      setFormData(prev => ({ ...prev, start_date: today }))
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchUsers()
    }
  }, [isOpen])

  const fetchUsers = async () => {
    try {
      // 生徒一覧を取得
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('full_name')

      // 講師一覧を取得
      const { data: instructorsData, error: instructorsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'instructor')
        .order('full_name')

      setStudents(studentsData || [])
      setInstructors(instructorsData || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const recurringData = {
        student_id: formData.student_id,
        instructor_id: formData.instructor_id || null,
        lesson_type: formData.lesson_type,
        subject: formData.subject,
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        is_active: true,
        notes: formData.notes || null,
        created_by: user?.id
      }

      const { error } = await supabase
        .from('recurring_schedules')
        .insert([recurringData])

      if (error) throw error

      // フォームリセット
      const resetData = {
        student_id: '',
        instructor_id: profile?.role === 'instructor' ? profile.id : '',
        lesson_type: 'video' as 'video' | 'face_to_face',
        subject: '',
        day_of_week: 1,
        start_time: '14:00',
        end_time: '15:30',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        notes: ''
      }
      setFormData(resetData)

      onSuccess()
      onClose()
      alert('定期スケジュールを作成しました')
    } catch (error) {
      console.error('Error creating recurring schedule:', error)
      alert('定期スケジュールの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">定期スケジュール作成</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 生徒選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              生徒 *
            </label>
            <select
              required
              value={formData.student_id}
              onChange={(e) => handleChange('student_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">生徒を選択してください</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* 講師選択（塾長の場合のみ） */}
          {profile?.role === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                講師
              </label>
              <select
                value={formData.instructor_id}
                onChange={(e) => handleChange('instructor_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">講師を選択してください</option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 授業タイプ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              授業タイプ *
            </label>
            <select
              required
              value={formData.lesson_type}
              onChange={(e) => handleChange('lesson_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="video">映像授業</option>
              <option value="face_to_face">対面授業</option>
            </select>
          </div>

          {/* 科目 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              科目 *
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              placeholder="例：数学、英語、物理"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 曜日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              曜日 *
            </label>
            <select
              required
              value={formData.day_of_week}
              onChange={(e) => handleChange('day_of_week', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DAYS_OF_WEEK.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>

          {/* 開始時間 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              開始時間 *
            </label>
            <input
              type="time"
              required
              value={formData.start_time}
              onChange={(e) => handleChange('start_time', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 終了時間 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              終了時間 *
            </label>
            <input
              type="time"
              required
              value={formData.end_time}
              onChange={(e) => handleChange('end_time', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 開始日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              開始日 *
            </label>
            <input
              type="date"
              required
              value={formData.start_date}
              onChange={(e) => handleChange('start_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">定期スケジュールが開始される日付</p>
          </div>

          {/* 終了日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              終了日（任意）
            </label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => handleChange('end_date', e.target.value)}
              min={formData.start_date}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">空白の場合は無期限で継続</p>
          </div>

          {/* 備考 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              備考
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="定期授業の詳細や注意事項など"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ボタン */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? '作成中...' : '定期スケジュール作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}