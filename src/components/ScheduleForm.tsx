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

  const [formData, setFormData] = useState({
    student_id: profile?.role === 'student' ? profile.id : '',
    lesson_type: 'video' as 'video' | 'face_to_face',
    subject: '',
    lesson_date: '',
    start_time: '14:00',
    end_time: '15:30',
    notes: ''
  })

  // 日付の初期化をuseEffectで行う（クライアントサイドのみ）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (initialDate) {
        setFormData(prev => ({ ...prev, lesson_date: initialDate.toISOString().split('T')[0] }))
      } else if (!formData.lesson_date) {
        const today = new Date().toISOString().split('T')[0]
        setFormData(prev => ({ ...prev, lesson_date: today }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDate])

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

    if (studentsError) {
      console.error('Error fetching students:', studentsError)
      return
    }

    setStudents(studentsData || [])
  } catch (error) {
    console.error('Error fetching users:', error)
  }
}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('schedules')
        .insert([{
          student_id: formData.student_id,
          instructor_id: null,
          lesson_type: formData.lesson_type,
          subject: formData.subject,
          lesson_date: formData.lesson_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          status: 'scheduled',
          notes: formData.notes || null,
          created_by: user?.id
        }])

      if (error) throw error

      // フォームリセット
      const resetData = {
        student_id: profile?.role === 'student' ? profile.id : '',
        lesson_type: 'video' as 'video' | 'face_to_face',
        subject: '',
        lesson_date: initialDate ? initialDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        start_time: '14:00',
        end_time: '15:30',
        notes: ''
      }
      setFormData(resetData)

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
          <h2 className="text-xl font-bold">
            単発で追加
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-[#8DCCB3] p-1 rounded-lg hover:bg-[#8DCCB3]/10 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 生徒選択（塾長・講師の場合のみ） */}
          {(profile?.role === 'admin' || profile?.role === 'instructor') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                生徒 *
              </label>
              <select
                required
                value={formData.student_id}
                onChange={(e) => handleChange('student_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200 hover:border-[#8DCCB3]/60"
              >
                <option value="">生徒を選択してください</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
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
              className="flex-1 px-4 py-2.5 border border-[#8DCCB3]/30 rounded-lg text-[#4A5568] hover:bg-[#8DCCB3]/10 hover:border-[#8DCCB3]/50 transition-all duration-200 font-medium"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-[#8DCCB3] text-white rounded-lg hover:bg-[#5FA084] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {loading ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}