'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface LessonNote {
  id: string
  instructor_id: string
  student_id: string | null
  lesson_date: string
  subject: string
  lesson_content: string
  student_progress: string
  next_lesson_plan: string
  handover_notes: string | null
  is_handover: boolean
  created_at: string
  updated_at: string
  instructor: Profile
  student: Profile | null
}

export default function LessonNotesPage() {
  const { user, profile, loading } = useAuth()
  const [lessonNotes, setLessonNotes] = useState<LessonNote[]>([])
  const [students, setStudents] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingNote, setEditingNote] = useState<LessonNote | null>(null)
  const [formData, setFormData] = useState({
    student_id: '',
    lesson_date: new Date().toISOString().split('T')[0],
    subject: '',
    lesson_content: '',
    student_progress: '',
    next_lesson_plan: '',
    handover_notes: '',
    is_handover: false
  })
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
        return
      }

      if (!profile || !['admin', 'instructor'].includes(profile.role)) {
        console.log('Access denied for role:', profile?.role)
        router.push('/dashboard')
        return
      }

      fetchData()
      // フォームが表示されている時のみ保存データを復元
      if (showForm && !editingNote) {
        loadSavedFormData()
      }
    }
  }, [user, profile, loading, router, showForm, editingNote])

  // フォームデータ自動保存
  useEffect(() => {
    if (showForm && !editingNote) {
      const timer = setTimeout(() => {
        saveFormData()
      }, 500) // 500ms後に保存
      
      return () => clearTimeout(timer)
    }
  }, [formData, showForm, editingNote])

  // ページ離脱時の保存
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (showForm && !editingNote && (formData.lesson_content || formData.student_progress || formData.next_lesson_plan || formData.handover_notes)) {
        saveFormData()
        e.preventDefault()
        e.returnValue = '入力中のデータがあります。ページを離れますか？'
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && showForm && !editingNote) {
        saveFormData()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [showForm, editingNote, formData])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      await Promise.all([fetchLessonNotes(), fetchStudents()])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveFormData = () => {
    try {
      setIsAutoSaving(true)
      const dataToSave = {
        ...formData,
        timestamp: new Date().toISOString()
      }
      localStorage.setItem('lesson_notes_draft', JSON.stringify(dataToSave))
      setTimeout(() => setIsAutoSaving(false), 500)
    } catch (error) {
      console.error('Error saving to localStorage:', error)
      setIsAutoSaving(false)
    }
  }

  const loadSavedFormData = () => {
    try {
      const saved = localStorage.getItem('lesson_notes_draft')
      if (saved) {
        const parsedData = JSON.parse(saved)
        const { timestamp, ...formDataOnly } = parsedData
        
        // 6時間以内かつ何か入力されているデータのみ復元
        const savedTime = new Date(timestamp)
        const now = new Date()
        const hoursDiff = (now.getTime() - savedTime.getTime()) / (1000 * 60 * 60)
        
        // 6時間以内でかつ実際に内容が入力されている場合のみ復元
        const hasContent = (
          formDataOnly.lesson_content?.trim() || 
          formDataOnly.student_progress?.trim() || 
          formDataOnly.next_lesson_plan?.trim() || 
          formDataOnly.handover_notes?.trim() ||
          (formDataOnly.student_id && formDataOnly.student_id !== '') ||
          (formDataOnly.subject?.trim() && formDataOnly.subject !== '')
        )
        
        if (hoursDiff < 6 && hasContent) {
          // ユーザーに復元するか確認
          const shouldRestore = confirm(
            `未保存の入力内容が見つかりました。\n前回の入力内容を復元しますか？\n\n（${Math.round(hoursDiff * 60)}分前に自動保存されました）`
          )
          
          if (shouldRestore) {
            setFormData(formDataOnly)
          } else {
            localStorage.removeItem('lesson_notes_draft')
          }
        } else {
          localStorage.removeItem('lesson_notes_draft')
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error)
      localStorage.removeItem('lesson_notes_draft')
    }
  }

  const clearSavedFormData = () => {
    localStorage.removeItem('lesson_notes_draft')
  }

  const fetchLessonNotes = async () => {
    try {
      const { data: lessonData, error: lessonError } = await supabase
        .from('lesson_notes')
        .select('*')
        .order('lesson_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (lessonError) throw lessonError

      if (lessonData && lessonData.length > 0) {
        const instructorIds = [...new Set(lessonData.map(note => note.instructor_id))]
        const studentIds = [...new Set(lessonData.map(note => note.student_id).filter(Boolean))]

        const [instructorsData, studentsData] = await Promise.all([
          instructorIds.length > 0 ? supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', instructorIds) : { data: [] },
          studentIds.length > 0 ? supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', studentIds) : { data: [] }
        ])

        const instructorsMap = new Map((instructorsData.data || []).map(inst => [inst.id, inst]))
        const studentsMap = new Map((studentsData.data || []).map(student => [student.id, student]))

        const notesWithProfiles = lessonData.map(note => ({
          ...note,
          instructor: instructorsMap.get(note.instructor_id) || { id: note.instructor_id, full_name: '不明な講師' },
          student: note.student_id ? studentsMap.get(note.student_id) || { id: note.student_id, full_name: '不明な生徒' } : null
        }))

        setLessonNotes(notesWithProfiles)
      } else {
        setLessonNotes([])
      }
    } catch (error) {
      console.error('Error fetching lesson notes:', error)
    }
  }

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('full_name')

      if (error) throw error
      setStudents(data || [])
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    try {
      const noteData = {
        instructor_id: profile.id,
        student_id: formData.student_id || null,
        lesson_date: formData.lesson_date,
        subject: formData.subject,
        lesson_content: formData.lesson_content,
        student_progress: formData.student_progress,
        next_lesson_plan: formData.next_lesson_plan,
        handover_notes: formData.handover_notes || null,
        is_handover: formData.is_handover
      }

      if (editingNote) {
        const { error } = await supabase
          .from('lesson_notes')
          .update({ ...noteData, updated_at: new Date().toISOString() })
          .eq('id', editingNote.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('lesson_notes')
          .insert([noteData])

        if (error) throw error
      }

      setFormData({
        student_id: '',
        lesson_date: new Date().toISOString().split('T')[0],
        subject: '',
        lesson_content: '',
        student_progress: '',
        next_lesson_plan: '',
        handover_notes: '',
        is_handover: false
      })
      clearSavedFormData()
      setShowForm(false)
      setEditingNote(null)
      fetchLessonNotes()
    } catch (error) {
      console.error('Error saving lesson note:', error)
      alert('保存中にエラーが発生しました')
    }
  }

  const handleEdit = (note: LessonNote) => {
    setEditingNote(note)
    setFormData({
      student_id: note.student_id || '',
      lesson_date: note.lesson_date,
      subject: note.subject,
      lesson_content: note.lesson_content,
      student_progress: note.student_progress,
      next_lesson_plan: note.next_lesson_plan,
      handover_notes: note.handover_notes || '',
      is_handover: note.is_handover
    })
    setShowForm(true)
  }

  const handleDelete = async (noteId: string) => {
    if (!confirm('この記録を削除しますか？')) return

    try {
      const { error } = await supabase
        .from('lesson_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error
      fetchLessonNotes()
    } catch (error) {
      console.error('Error deleting lesson note:', error)
      alert('削除中にエラーが発生しました')
    }
  }

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <div className="mb-4 sm:mb-0">
                <h3 className="text-lg leading-6 font-medium text-gray-900">授業記録ノート</h3>
                <p className="mt-1 text-sm text-gray-500">
                  授業の記録と講師間の引き継ぎ事項を管理します
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8DCCB3] transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  ダッシュボードに戻る
                </button>
                <button
                  onClick={() => {
                    // 新規作成時は初期化してからフォーム表示
                    setFormData({
                      student_id: '',
                      lesson_date: new Date().toISOString().split('T')[0],
                      subject: '',
                      lesson_content: '',
                      student_progress: '',
                      next_lesson_plan: '',
                      handover_notes: '',
                      is_handover: false
                    })
                    setEditingNote(null)
                    setShowForm(true)
                    // フォーム表示後に保存データを確認して復元
                    setTimeout(() => {
                      loadSavedFormData()
                    }, 100)
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#8DCCB3] hover:bg-[#5FA084] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8DCCB3] transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  新しい記録を作成
                </button>
              </div>
            </div>


            {showForm && (
              <div className="border-t border-gray-200 mt-6">
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center mb-3 sm:mb-0">
                      <h4 className="text-base font-medium text-gray-900">
                        {editingNote ? '記録を編集' : '新しい記録を作成'}
                      </h4>
                      {!editingNote && isAutoSaving && (
                        <div className="ml-3 flex items-center text-[#8DCCB3] text-sm">
                          <div className="w-4 h-4 border-2 border-[#8DCCB3]/20 border-t-[#8DCCB3] rounded-full animate-spin mr-2"></div>
                          自動保存中...
                        </div>
                      )}
                      {!editingNote && !isAutoSaving && (
                        <div className="ml-3 flex items-center text-[#8DCCB3] text-sm">
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          自動保存済み
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (!editingNote && (formData.lesson_content || formData.student_progress || formData.next_lesson_plan || formData.handover_notes)) {
                          if (confirm('入力中のデータがあります。本当に閉じますか？')) {
                            setShowForm(false)
                            setEditingNote(null)
                          }
                        } else {
                          setShowForm(false)
                          setEditingNote(null)
                        }
                      }}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8DCCB3] transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      閉じる
                    </button>
                  </div>
                </div>

                <div className="px-4 py-5 sm:p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* 基本情報 */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">基本情報</h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            生徒 *
                          </label>
                          <select
                            value={formData.student_id}
                            onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] sm:text-sm"
                            required
                          >
                            <option value="">選択してください</option>
                            {students.map((student) => (
                              <option key={student.id} value={student.id}>
                                {student.full_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            授業日 *
                          </label>
                          <input
                            type="date"
                            value={formData.lesson_date}
                            onChange={(e) => setFormData({ ...formData, lesson_date: e.target.value })}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] sm:text-sm"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            科目 *
                          </label>
                          <input
                            type="text"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] sm:text-sm"
                            placeholder="例: 数学、英語"
                            required
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.is_handover}
                            onChange={(e) => setFormData({ ...formData, is_handover: e.target.checked })}
                            className="rounded border-gray-300 text-[#8DCCB3] focus:ring-[#8DCCB3]"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-900">重要な引き継ぎ事項</span>
                        </label>
                      </div>
                    </div>

                    {/* 授業記録 */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">授業記録</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            授業内容 *
                          </label>
                          <textarea
                            value={formData.lesson_content}
                            onChange={(e) => setFormData({ ...formData, lesson_content: e.target.value })}
                            rows={3}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] sm:text-sm resize-none"
                            placeholder="実施した授業の内容を記録してください"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            生徒の理解度・進捗 *
                          </label>
                          <textarea
                            value={formData.student_progress}
                            onChange={(e) => setFormData({ ...formData, student_progress: e.target.value })}
                            rows={3}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] sm:text-sm resize-none"
                            placeholder="生徒の理解度や取り組み状況を記録してください"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            次回授業の予定・準備事項 *
                          </label>
                          <textarea
                            value={formData.next_lesson_plan}
                            onChange={(e) => setFormData({ ...formData, next_lesson_plan: e.target.value })}
                            rows={3}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] sm:text-sm resize-none"
                            placeholder="次回授業で扱う内容や準備事項を記録してください"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* 引き継ぎメモ */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">引き継ぎメモ</h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          講師間引き継ぎメモ
                        </label>
                        <textarea
                          value={formData.handover_notes}
                          onChange={(e) => setFormData({ ...formData, handover_notes: e.target.value })}
                          rows={3}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] sm:text-sm resize-none"
                          placeholder="他の講師や塾長に伝えたい特別な事項があれば記録してください"
                        />
                      </div>
                    </div>

                    {/* ボタン */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-6 border-t border-gray-200 space-y-3 sm:space-y-0">
                      <div className="text-sm text-gray-500">
                        {!editingNote ? '入力内容は自動的に保存されます' : ''}
                      </div>
                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!editingNote && (formData.lesson_content || formData.student_progress || formData.next_lesson_plan || formData.handover_notes)) {
                              if (confirm('入力中のデータがあります。本当にキャンセルしますか？')) {
                                setShowForm(false)
                                setEditingNote(null)
                              }
                            } else {
                              setShowForm(false)
                              setEditingNote(null)
                            }
                          }}
                          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8DCCB3]"
                        >
                          キャンセル
                        </button>
                        <button
                          type="submit"
                          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#8DCCB3] hover:bg-[#5FA084] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8DCCB3]"
                        >
                          {editingNote ? '更新する' : '記録を保存'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="bg-white shadow rounded-lg overflow-hidden">
              {lessonNotes.length === 0 ? (
                <div className="px-4 py-5 sm:p-6 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">まだ記録がありません</h3>
                  <p className="text-sm text-gray-500">上の「新しい記録を作成」ボタンから最初の授業記録を作成してください</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {lessonNotes.map((note) => (
                    <div key={note.id} className="px-4 py-5 sm:p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-4">
                        <div className="flex-1 mb-3 lg:mb-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-base font-medium text-gray-900">
                              {note.student?.full_name || '不明な生徒'} - {note.subject}
                            </h4>
                            {note.is_handover && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                重要
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {new Date(note.lesson_date).toLocaleDateString('ja-JP', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric',
                              weekday: 'short'
                            })} | 講師: {note.instructor.full_name}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(note)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-[#8DCCB3] bg-[#8DCCB3]/5 hover:bg-[#8DCCB3]/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8DCCB3]"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(note.id)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-red-600 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            削除
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 text-sm">
                        <div>
                          <h5 className="font-medium text-gray-700 mb-1">授業内容</h5>
                          <p className="text-gray-600 leading-relaxed">{note.lesson_content}</p>
                        </div>
                        <div>
                          <h5 className="font-medium text-gray-700 mb-1">生徒の理解度・進捗</h5>
                          <p className="text-gray-600 leading-relaxed">{note.student_progress}</p>
                        </div>
                        <div>
                          <h5 className="font-medium text-gray-700 mb-1">次回授業の予定</h5>
                          <p className="text-gray-600 leading-relaxed">{note.next_lesson_plan}</p>
                        </div>
                        {note.handover_notes && (
                          <div className="p-3 bg-[#8DCCB3]/10 rounded-md border-l-4 border-[#8DCCB3]">
                            <h5 className="font-medium text-gray-700 mb-1">引き継ぎメモ</h5>
                            <p className="text-gray-700 leading-relaxed">{note.handover_notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
                        作成: {new Date(note.created_at).toLocaleString('ja-JP')}
                        {note.updated_at !== note.created_at && (
                          <span className="ml-3">更新: {new Date(note.updated_at).toLocaleString('ja-JP')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}