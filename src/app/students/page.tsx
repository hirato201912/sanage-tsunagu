'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'

export default function StudentsPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [students, setStudents] = useState<Profile[]>([])
  const [instructors, setInstructors] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Profile | null>(null)

  // フォーム用の状態
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    classroomId: '',
    instructorId: ''
  })

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'admin')) {
      router.push('/dashboard')
    }
  }, [user, profile, loading, router])

  useEffect(() => {
    if (user && profile?.role === 'admin') {
      fetchData()
    }
  }, [user, profile])

  const fetchData = async () => {
    try {
      // 生徒一覧を取得
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false })

      if (studentsError) throw studentsError

      // 講師一覧を取得（担当講師選択用）
      const { data: instructorsData, error: instructorsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'instructor')
        .order('full_name')

      if (instructorsError) throw instructorsError

      setStudents(studentsData || [])
      setInstructors(instructorsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (editingStudent) {
        // 編集の場合
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.fullName,
            classroom_id: formData.classroomId || null
          })
          .eq('id', editingStudent.id)

        if (error) throw error
      } else {
        // 新規登録の場合
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password
        })

        if (authError) throw authError

        if (authData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: authData.user.id,
              full_name: formData.fullName,
              role: 'student',
              classroom_id: formData.classroomId || null
            })

          if (profileError) throw profileError
        }
      }

      // フォームをリセット
      setFormData({ email: '', password: '', fullName: '', classroomId: '', instructorId: '' })
      setShowAddForm(false)
      setEditingStudent(null)
      await fetchData()
    } catch (error: any) {
      console.error('Error:', error)
      alert(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (student: Profile) => {
    setEditingStudent(student)
    setFormData({
      email: '',
      password: '',
      fullName: student.full_name,
      classroomId: student.classroom_id || '',
      instructorId: ''
    })
    setShowAddForm(true)
  }

  const handleDelete = async (student: Profile) => {
    if (!confirm(`${student.full_name}さんを削除しますか？`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', student.id)

      if (error) throw error
      await fetchData()
    } catch (error: any) {
      console.error('Error deleting student:', error)
      alert('削除に失敗しました: ' + error.message)
    }
  }

  const resetForm = () => {
    setFormData({ email: '', password: '', fullName: '', classroomId: '', instructorId: '' })
    setShowAddForm(false)
    setEditingStudent(null)
  }

  // 担当講師を取得する関数（今後の機能拡張用）
  const getInstructorName = (instructorId: string) => {
    const instructor = instructors.find(i => i.id === instructorId)
    return instructor ? instructor.full_name : '-'
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>読み込み中...</div>
      </div>
    )
  }

  if (!user || profile?.role !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← ダッシュボードに戻る
              </button>
              <h1 className="text-2xl font-bold text-gray-900">生徒管理</h1>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              新しい生徒を追加
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 生徒追加/編集フォーム */}
          {showAddForm && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-lg font-medium mb-4">
                {editingStudent ? '生徒情報を編集' : '新しい生徒を追加'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingStudent && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        メールアドレス
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        パスワード
                      </label>
                      <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    名前
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    所属教室ID（任意）
                  </label>
                  <input
                    type="text"
                    value={formData.classroomId}
                    onChange={(e) => setFormData({ ...formData, classroomId: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                  >
                    {editingStudent ? '更新' : '追加'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 生徒一覧 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                生徒一覧（{students.length}名）
              </h3>
              {students.length === 0 ? (
                <p className="text-gray-500">生徒が登録されていません。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          名前
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          所属教室ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          登録日
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map((student) => (
                        <tr key={student.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                  <span className="text-green-600 font-medium text-sm">
                                    {student.full_name.charAt(0)}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {student.full_name}
                                </div>
                                <div className="text-sm text-gray-500">生徒</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {student.classroom_id || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {new Date(student.created_at).toLocaleDateString('ja-JP')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleEdit(student)}
                              className="text-indigo-600 hover:text-indigo-900 mr-3"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDelete(student)}
                              className="text-red-600 hover:text-red-900"
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 統計情報 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-sm font-medium">{students.length}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">総生徒数</p>
                  <p className="text-lg font-semibold text-gray-900">{students.length}名</p>
                </div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-medium">{instructors.length}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">講師数</p>
                  <p className="text-lg font-semibold text-gray-900">{instructors.length}名</p>
                </div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 text-sm font-medium">
                      {instructors.length > 0 ? Math.round(students.length / instructors.length) : 0}
                    </span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">講師1人あたり</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {instructors.length > 0 ? Math.round(students.length / instructors.length) : 0}名
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}