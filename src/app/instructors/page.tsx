'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import { useSaveCurrentPage } from '@/hooks/useSaveCurrentPage'
import LoadingScreen from '@/components/LoadingScreen'

export default function InstructorsPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [instructors, setInstructors] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingInstructor, setEditingInstructor] = useState<Profile | null>(null)

  // リロード時にこのページに戻れるように保存
  useSaveCurrentPage()

  // フォーム用の状態
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    classroomId: ''
  })

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'admin')) {
      router.push('/dashboard')
    }
  }, [user, profile, loading, router])

  useEffect(() => {
    if (user && profile?.role === 'admin') {
      fetchInstructors()
    }
  }, [user, profile])

  const fetchInstructors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'instructor')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInstructors(data || [])
    } catch (error) {
      console.error('Error fetching instructors:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (editingInstructor) {
        // 編集の場合
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.fullName,
            classroom_id: formData.classroomId || null
          })
          .eq('id', editingInstructor.id)

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
              role: 'instructor',
              classroom_id: formData.classroomId || null
            })

          if (profileError) throw profileError
        }
      }

      // フォームをリセット
      setFormData({ email: '', password: '', fullName: '', classroomId: '' })
      setShowAddForm(false)
      setEditingInstructor(null)
      await fetchInstructors()
    } catch (error: any) {
      console.error('Error:', error)
      alert(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (instructor: Profile) => {
    setEditingInstructor(instructor)
    setFormData({
      email: '',
      password: '',
      fullName: instructor.full_name,
      classroomId: instructor.classroom_id || ''
    })
    setShowAddForm(true)
  }

  const handleDelete = async (instructor: Profile) => {
    if (!confirm(`${instructor.full_name}さんを削除しますか？`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', instructor.id)

      if (error) throw error
      await fetchInstructors()
    } catch (error: any) {
      console.error('Error deleting instructor:', error)
      alert('削除に失敗しました: ' + error.message)
    }
  }

  const resetForm = () => {
    setFormData({ email: '', password: '', fullName: '', classroomId: '' })
    setShowAddForm(false)
    setEditingInstructor(null)
  }

  if (loading || isLoading) {
    return <LoadingScreen message="講師情報を読み込んでいます" />
  }

  if (!user || profile?.role !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#6BB6A8] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-5">
            <div className="flex items-center space-x-3">
              <div className="bg-white rounded-xl p-2 shadow-md">
                <img src="/main_icon.png" alt="ツナグ" className="h-9 w-9" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">講師管理</h1>
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
          <div className="border-t border-white/20 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-[#6BB6A8] px-6 py-3 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>新しい講師を追加</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 講師追加/編集フォーム */}
          {showAddForm && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-lg font-medium mb-4">
                {editingInstructor ? '講師情報を編集' : '新しい講師を追加'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingInstructor && (
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
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    担当教室ID（任意）
                  </label>
                  <input
                    type="text"
                    value={formData.classroomId}
                    onChange={(e) => setFormData({ ...formData, classroomId: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                  >
                    {editingInstructor ? '更新' : '追加'}
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

          {/* 講師一覧 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                講師一覧（{instructors.length}名）
              </h3>
              {instructors.length === 0 ? (
                <p className="text-gray-500">講師が登録されていません。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          名前
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          担当教室ID
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
                      {instructors.map((instructor) => (
                        <tr key={instructor.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {instructor.full_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {instructor.classroom_id || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {new Date(instructor.created_at).toLocaleDateString('ja-JP')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleEdit(instructor)}
                              className="text-indigo-600 hover:text-indigo-900 mr-3"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDelete(instructor)}
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
        </div>
      </main>
    </div>
  )
}