'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import TestScoreHeatmap from '@/components/TestScoreHeatmap'

const PRESET_SUBJECTS = [
  '現代の国語',
  '言語文化', 
  '論理・表現',
  '地理総合',
  '歴史総合',
  '公共',
  '数学I',
  '数学A',
  '物理基礎',
  '化学基礎',
  '生物基礎',
  '体育',
  '保健',
  '音楽I',
  '美術I',
  '英語コミュニケーションI',
  '論理・表現I',
  '家庭基礎',
  '情報I'
] as const

interface TestScore {
  id: string
  student_id: string
  subject: string
  test_period: string
  test_date: string
  score: number
  max_score: number
  class_average: number | null
  student_rank: number | null
  total_students: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface TestScoreWithProfile extends TestScore {
  student: Profile
}

export default function TestScoresPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [students, setStudents] = useState<Profile[]>([])
  const [testScores, setTestScores] = useState<TestScoreWithProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'heatmap'>('list')
  const [formData, setFormData] = useState({
    student_id: '',
    subject: '',
    custom_subject: '',
    test_period: '',
    test_date: '',
    score: '',
    max_score: '100',
    class_average: '',
    student_rank: '',
    total_students: '',
    notes: ''
  })

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
      
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('full_name')

      if (studentsError) throw studentsError

      const { data: scoresData, error: scoresError } = await supabase
        .from('test_scores')
        .select(`
          *,
          student:student_id(id, full_name, role)
        `)
        .order('test_date', { ascending: false })

      if (scoresError) throw scoresError

      setStudents(studentsData || [])
      setTestScores(scoresData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const finalSubject = formData.subject === 'custom' 
      ? formData.custom_subject.trim()
      : formData.subject

    if (!finalSubject) {
      alert('科目を選択または入力してください')
      return
    }

    try {
      const { error } = await supabase
        .from('test_scores')
        .insert([{
          student_id: formData.student_id,
          subject: finalSubject,
          test_period: formData.test_period,
          test_date: formData.test_date,
          score: parseInt(formData.score),
          max_score: parseInt(formData.max_score),
          class_average: formData.class_average ? parseFloat(formData.class_average) : null,
          student_rank: formData.student_rank ? parseInt(formData.student_rank) : null,
          total_students: formData.total_students ? parseInt(formData.total_students) : null,
          notes: formData.notes || null
        }])

      if (error) throw error

      setFormData({
        student_id: '',
        subject: '',
        custom_subject: '',
        test_period: '',
        test_date: '',
        score: '',
        max_score: '100',
        class_average: '',
        student_rank: '',
        total_students: '',
        notes: ''
      })
      setShowForm(false)
      fetchData()
    } catch (error) {
      console.error('Error adding test score:', error)
      alert('テスト成績の追加に失敗しました')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>読み込み中...</div>
      </div>
    )
  }

  if (!user || !profile || profile.role !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b-2 border-[#8DCCB3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <img src="/main_icon.png" alt="ツナグ" className="h-12 w-12" />
              <div>
                <h1 className="text-3xl font-bold text-[#8DCCB3]">テスト成績管理</h1>
                <p className="text-sm text-gray-600 mt-1">定期考査の成績入力・推移分析</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowForm(true)}
                className="bg-[#8DCCB3] hover:bg-[#5FA084] text-white px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md flex items-center space-x-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>成績追加</span>
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-[#8DCCB3] px-4 py-2 rounded-lg transition-all duration-200 hover:bg-[#8DCCB3]/10"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm font-medium">ダッシュボード</span>
              </button>
            </div>
          </div>

          {/* タブナビゲーション */}
          <div className="border-t border-gray-200">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('list')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'list'
                    ? 'border-[#8DCCB3] text-[#8DCCB3]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-[#8DCCB3]/30'
                }`}
              >
                成績一覧
              </button>
              <button
                onClick={() => setActiveTab('heatmap')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'heatmap'
                    ? 'border-[#8DCCB3] text-[#8DCCB3]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-[#8DCCB3]/30'
                }`}
              >
                成績推移分析
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* 成績入力フォーム */}
          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-6 border w-11/12 md:w-3/4 lg:w-1/2 shadow-xl rounded-lg bg-white border-t-4 border-[#8DCCB3]">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-[#8DCCB3] flex items-center">
                      <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      テスト成績追加
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">生徒 *</label>
                        <select
                          name="student_id"
                          value={formData.student_id}
                          onChange={handleInputChange}
                          required
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                        >
                          <option value="">選択してください</option>
                          {students.map(student => (
                            <option key={student.id} value={student.id}>
                              {student.full_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">科目 *</label>
                        <select
                          name="subject"
                          value={formData.subject}
                          onChange={handleInputChange}
                          required
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                        >
                          <option value="">選択してください</option>
                          {PRESET_SUBJECTS.map(subject => (
                            <option key={subject} value={subject}>
                              {subject}
                            </option>
                          ))}
                          <option value="custom">その他（自由入力）</option>
                        </select>
                      </div>

                      {formData.subject === 'custom' && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">科目名（自由入力） *</label>
                          <input
                            type="text"
                            name="custom_subject"
                            value={formData.custom_subject}
                            onChange={handleInputChange}
                            required
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                            placeholder="科目名を入力"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">試験名 *</label>
                        <input
                          type="text"
                          name="test_period"
                          value={formData.test_period}
                          onChange={handleInputChange}
                          required
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                          placeholder="例: 1学期中間考査"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">試験日 *</label>
                        <input
                          type="date"
                          name="test_date"
                          value={formData.test_date}
                          onChange={handleInputChange}
                          required
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">得点 *</label>
                        <input
                          type="number"
                          name="score"
                          value={formData.score}
                          onChange={handleInputChange}
                          required
                          min="0"
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                          placeholder="点数"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">満点 *</label>
                        <input
                          type="number"
                          name="max_score"
                          value={formData.max_score}
                          onChange={handleInputChange}
                          required
                          min="1"
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">クラス平均</label>
                        <input
                          type="number"
                          name="class_average"
                          value={formData.class_average}
                          onChange={handleInputChange}
                          step="0.1"
                          min="0"
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                          placeholder="平均点"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">順位</label>
                        <input
                          type="number"
                          name="student_rank"
                          value={formData.student_rank}
                          onChange={handleInputChange}
                          min="1"
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                          placeholder="順位"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">総生徒数</label>
                        <input
                          type="number"
                          name="total_students"
                          value={formData.total_students}
                          onChange={handleInputChange}
                          min="1"
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                          placeholder="クラス人数"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="メモや特記事項"
                      />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200"
                      >
                        キャンセル
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 bg-[#8DCCB3] hover:bg-[#5FA084] border border-transparent rounded-lg text-sm font-medium text-white transition-all duration-200 shadow-sm hover:shadow-md flex items-center space-x-2"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>保存</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* タブコンテンツ */}
          {activeTab === 'list' && (
            <div className="bg-white shadow-sm rounded-lg border-t-4 border-[#8DCCB3]">
              <div className="px-6 py-6">
                <h3 className="text-xl font-semibold text-[#8DCCB3] mb-6 flex items-center">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  テスト成績一覧
                </h3>
                
                {testScores.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="mx-auto w-16 h-16 bg-[#8DCCB3]/10 rounded-full flex items-center justify-center mb-4">
                      <svg className="h-8 w-8 text-[#8DCCB3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-lg mb-2">テスト成績がまだ登録されていません</p>
                    <p className="text-gray-400 text-sm">「成績追加」ボタンから新しいテスト成績を追加してください。</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-[#8DCCB3]/5">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-[#8DCCB3] uppercase tracking-wider">試験日</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-[#8DCCB3] uppercase tracking-wider">生徒名</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-[#8DCCB3] uppercase tracking-wider">試験名</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-[#8DCCB3] uppercase tracking-wider">科目</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-[#8DCCB3] uppercase tracking-wider">得点</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-[#8DCCB3] uppercase tracking-wider">得点率</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-[#8DCCB3] uppercase tracking-wider">クラス平均</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-[#8DCCB3] uppercase tracking-wider">順位</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {testScores.map((score, index) => (
                          <tr key={score.id} className={`hover:bg-[#8DCCB3]/5 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(score.test_date).toLocaleDateString('ja-JP')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {score.student.full_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {score.test_period}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {score.subject}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {score.score} / {score.max_score}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                                (score.score / score.max_score) * 100 >= 80 ? 'bg-green-100 text-green-800 ring-1 ring-green-200' :
                                (score.score / score.max_score) * 100 >= 60 ? 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200' :
                                'bg-red-100 text-red-800 ring-1 ring-red-200'
                              }`}>
                                {Math.round((score.score / score.max_score) * 100)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {score.class_average ? `${score.class_average}点` : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {score.student_rank && score.total_students 
                                ? `${score.student_rank} / ${score.total_students}` 
                                : score.student_rank ? `${score.student_rank}位` : '-'
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ヒートマップタブ */}
          {activeTab === 'heatmap' && (
            <TestScoreHeatmap />
          )}
        </div>
      </main>
    </div>
  )
}