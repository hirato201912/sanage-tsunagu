'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile } from '@/lib/supabase'

interface ScheduleFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialDate?: Date
}

export default function ScheduleForm({ isOpen, onClose, onSuccess, initialDate }: ScheduleFormProps) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [students, setStudents] = useState<Profile[]>([])
  const [instructors, setInstructors] = useState<Profile[]>([])

  const [formData, setFormData] = useState({
    student_id: '',
    instructor_id: profile?.role === 'instructor' ? profile.id : '',
    lesson_type: 'video' as 'video' | 'face_to_face',
    subject: '',
    lesson_date: initialDate ? initialDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    start_time: '14:00',
    end_time: '15:30',
    notes: ''
  })

  useEffect(() => {
    if (isOpen) {
      fetchUsers()
    }
  }, [isOpen])


  const fetchUsers = async () => {
  try {
    console.log('Fetching users...')
    
    // 生徒一覧を取得
    const { data: studentsData, error: studentsError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('full_name')

    console.log('Students data:', studentsData)
    console.log('Students error:', studentsError)

    // 講師一覧を取得
    const { data: instructorsData, error: instructorsError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'instructor')
      .order('full_name')

    console.log('Instructors data:', instructorsData)
    console.log('Instructors error:', instructorsError)

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
      const { error } = await supabase
        .from('schedules')
        .insert([{
          student_id: formData.student_id,
          instructor_id: formData.instructor_id || null,
          lesson_type: formData.lesson_type,
          subject: formData.subject,
          lesson_date: formData.lesson_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          status: 'scheduled',
          notes: formData.notes || null
        }])

      if (error) throw error

      // フォームリセット
      setFormData({
        student_id: '',
        instructor_id: profile?.role === 'instructor' ? profile.id : '',
        lesson_type: 'video',
        subject: '',
        lesson_date: initialDate ? initialDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        start_time: '14:00',
        end_time: '15:30',
        notes: ''
      })

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating schedule:', error)
      alert('スケジュールの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">スケジュール作成</h2>
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

          {/* 日付 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              日付 *
            </label>
            <input
              type="date"
              required
              value={formData.lesson_date}
              onChange={(e) => handleChange('lesson_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

          {/* 備考 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              備考
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="授業の詳細や注意事項など"
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}