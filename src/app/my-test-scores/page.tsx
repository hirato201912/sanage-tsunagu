'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import { useSaveCurrentPage } from '@/hooks/useSaveCurrentPage'

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

const PRESET_TEST_NAMES = [
  '1学期中間考査',
  '1学期期末考査',
  '2学期中間考査',
  '2学期期末考査',
  '3学期学年末考査',
  '課題テスト',
  '実力テスト',
  '模試',
  '小テスト'
] as const

interface TestScore {
  id: string
  student_id: string
  subject: string
  test_period: string
  test_date: string | null
  score: number
  class_average: number | null
  student_rank: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface TestExam {
  test_period: string
  test_date: string | null
  subjects: TestScore[]
  totalSubjects: number
  averageScore: number
  created_at: string
}

interface SubjectScore {
  subject: string
  score: string
  class_average: string
  rank: string
}

export default function MyTestScoresPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [testExams, setTestExams] = useState<TestExam[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingExam, setEditingExam] = useState<TestExam | null>(null)
  const [formData, setFormData] = useState({
    test_period: '',
    test_date: '',
    subjects: [] as SubjectScore[]
  })

  // リロード時にこのページに戻れるように保存
  useSaveCurrentPage()

  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/login')
    } else if (!loading && profile && profile.role !== 'student') {
      router.push('/dashboard')
    }
  }, [user, profile, loading, router])

  useEffect(() => {
    if (profile && profile.role === 'student') {
      fetchMyScores()
    }
  }, [profile])

  const fetchMyScores = async () => {
    if (!profile) return
    
    try {
      setIsLoading(true)
      
      const { data: scoresData, error } = await supabase
        .from('test_scores')
        .select('*')
        .eq('student_id', profile.id)
        .order('test_date', { ascending: false })

      if (error) throw error

      // 試験名でグループ化
      const examGroups: { [key: string]: TestScore[] } = {}
      scoresData?.forEach(score => {
        if (!examGroups[score.test_period]) {
          examGroups[score.test_period] = []
        }
        examGroups[score.test_period].push(score)
      })

      // TestExam形式に変換
      const exams: TestExam[] = Object.entries(examGroups).map(([testPeriod, subjects]) => {
        const validScores = subjects.filter(s => s.score > 0)
        const averageScore = validScores.length > 0 
          ? Math.round(validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length)
          : 0

        return {
          test_period: testPeriod,
          test_date: subjects[0]?.test_date || null,
          subjects: subjects.sort((a, b) => a.subject.localeCompare(b.subject)),
          totalSubjects: subjects.length,
          averageScore,
          created_at: subjects[0]?.created_at || ''
        }
      })

      setTestExams(exams.sort((a, b) => {
        const dateA = new Date(a.test_date || a.created_at)
        const dateB = new Date(b.test_date || b.created_at)
        return dateB.getTime() - dateA.getTime()
      }))
    } catch (error) {
      console.error('Error fetching my test scores:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const initializeForm = (exam?: TestExam) => {
    if (exam) {
      // 編集モード
      setEditingExam(exam)
      setFormData({
        test_period: exam.test_period,
        test_date: exam.test_date || '',
        subjects: exam.subjects.map(s => ({
          subject: s.subject,
          score: s.score.toString(),
          class_average: (s.class_average || '').toString(),
          rank: s.student_rank?.toString() || ''
        }))
      })
    } else {
      // 新規作成モード
      setEditingExam(null)
      setFormData({
        test_period: '',
        test_date: '',
        subjects: PRESET_SUBJECTS.slice(0, 5).map(subject => ({
          subject,
          score: '',
          class_average: '',
          rank: ''
        }))
      })
    }
    setShowForm(true)
  }

  const addSubject = () => {
    setFormData(prev => ({
      ...prev,
      subjects: [...prev.subjects, { subject: '', score: '', class_average: '', rank: '' }]
    }))
  }

  const removeSubject = (index: number) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index)
    }))
  }

  const updateSubject = (index: number, field: keyof SubjectScore, value: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.map((subject, i) => 
        i === index ? { ...subject, [field]: value } : subject
      )
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!profile) return

    if (!formData.test_period.trim()) {
      alert('試験名を入力してください')
      return
    }

    const validSubjects = formData.subjects.filter(s => s.subject && s.score && parseInt(s.score) >= 0)
    
    if (validSubjects.length === 0) {
      alert('少なくとも1つの科目の成績を入力してください')
      return
    }

    try {
      if (editingExam) {
        // 既存のレコードを削除
        await supabase
          .from('test_scores')
          .delete()
          .eq('student_id', profile.id)
          .eq('test_period', editingExam.test_period)
      }

      // 新しいレコードを挿入
      const insertData = validSubjects.map(subject => ({
        student_id: profile.id,
        subject: subject.subject,
        test_period: formData.test_period.trim(),
        test_date: formData.test_date || null,
        score: parseInt(subject.score),
        class_average: subject.class_average ? parseFloat(subject.class_average) : null,
        student_rank: subject.rank ? parseInt(subject.rank) : null,
        notes: null
      }))

      const { error } = await supabase
        .from('test_scores')
        .insert(insertData)

      if (error) throw error

      setShowForm(false)
      setEditingExam(null)
      fetchMyScores()
    } catch (error) {
      console.error('Error saving test scores:', error)
      const errorMessage = error instanceof Error ? error.message : '不明なエラー'
      alert(`成績の保存に失敗しました: ${errorMessage}`)
    }
  }

  const deleteExam = async (exam: TestExam) => {
    if (!confirm(`「${exam.test_period}」の成績を削除しますか？`)) return

    try {
      await supabase
        .from('test_scores')
        .delete()
        .eq('student_id', profile?.id)
        .eq('test_period', exam.test_period)

      fetchMyScores()
    } catch (error) {
      console.error('Error deleting exam:', error)
      alert('成績の削除に失敗しました')
    }
  }

  const getScoreColor = (score: number) => {
    // 目立たないグレー系の統一カラー
    return 'bg-gray-100 text-gray-700 border border-gray-200'
  }

  const getAverageColor = (average: number) => {
    if (average >= 85) return 'bg-emerald-600'
    if (average >= 75) return 'bg-[#8DCCB3]'
    if (average >= 65) return 'bg-[#5FA084]'
    if (average >= 55) return 'bg-yellow-600'
    return 'bg-orange-600'
  }

  if (loading || isLoading) {
    return <LoadingScreen message="テスト成績を読み込んでいます" />
  }

  if (!user || !profile || profile.role !== 'student') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-[#6BB6A8] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-5">
            <div className="flex items-center space-x-3">
              <div className="bg-white rounded-xl p-2 shadow-md">
                <img src="/main_icon.png" alt="ツナグ" className="h-9 w-9" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">マイ成績</h1>
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
                onClick={() => initializeForm()}
                className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-[#6BB6A8] px-6 py-3 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>新しい試験を追加</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        {/* 成績入力・編集フォーム */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-4 mx-auto p-4 md:p-6 border-0 w-11/12 md:w-4/5 lg:w-3/4 max-w-4xl shadow-lg rounded-lg bg-white">
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl md:text-2xl font-bold text-[#8DCCB3] flex items-center">
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {editingExam ? '成績を編集' : '新しい試験を追加'}
                  </h3>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* 基本情報 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        試験名 *
                      </label>
                      <div className="space-y-2">
                        <select
                          value={PRESET_TEST_NAMES.includes(formData.test_period as any) ? formData.test_period : 'custom'}
                          onChange={(e) => {
                            if (e.target.value === 'custom') {
                              setFormData(prev => ({ ...prev, test_period: '' }))
                            } else {
                              setFormData(prev => ({ ...prev, test_period: e.target.value }))
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-1 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                        >
                          <option value="custom">カスタム入力</option>
                          {PRESET_TEST_NAMES.map(testName => (
                            <option key={testName} value={testName}>{testName}</option>
                          ))}
                        </select>
                        {(!PRESET_TEST_NAMES.includes(formData.test_period as any) || formData.test_period === '') && (
                          <input
                            type="text"
                            value={formData.test_period}
                            onChange={(e) => setFormData(prev => ({ ...prev, test_period: e.target.value }))}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-1 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                            placeholder="試験名を入力してください"
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        試験日
                      </label>
                      <input
                        type="date"
                        value={formData.test_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, test_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-1 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                      />
                    </div>
                  </div>

                  {/* 科目成績入力 */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-800">科目別成績</h4>
                      <button
                        type="button"
                        onClick={addSubject}
                        className="bg-[#8DCCB3]/10 hover:bg-[#8DCCB3]/20 text-[#8DCCB3] px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 shadow-sm hover:shadow-md"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>科目を追加</span>
                      </button>
                    </div>

                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {formData.subjects.map((subject, index) => (
                        <div key={index} className="p-4 bg-gray-50 rounded-xl border-2 border-[#8DCCB3]/20 shadow-md">
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-sm font-bold text-[#8DCCB3] mb-2">科目</label>
                              <select
                                value={subject.subject}
                                onChange={(e) => updateSubject(index, 'subject', e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] bg-white shadow-sm"
                              >
                                <option value="">科目を選択</option>
                                {PRESET_SUBJECTS.map(subj => (
                                  <option key={subj} value={subj}>{subj}</option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">得点 *</label>
                                <input
                                  type="number"
                                  value={subject.score}
                                  onChange={(e) => updateSubject(index, 'score', e.target.value)}
                                  min="0"
                                  max="100"
                                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-bold focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] text-center shadow-sm"
                                  placeholder="85"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">クラス平均</label>
                                <input
                                  type="number"
                                  value={subject.class_average}
                                  onChange={(e) => updateSubject(index, 'class_average', e.target.value)}
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] text-center shadow-sm"
                                  placeholder="70.5"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">順位</label>
                                <input
                                  type="number"
                                  value={subject.rank}
                                  onChange={(e) => updateSubject(index, 'rank', e.target.value)}
                                  min="1"
                                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] text-center shadow-sm"
                                  placeholder="5"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end pt-2">
                              <button
                                type="button"
                                onClick={() => removeSubject(index)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* フォームボタン */}
                  <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-3 bg-[#8DCCB3] hover:bg-[#5FA084] text-white rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center space-x-2"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{editingExam ? '更新' : '保存'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* メインコンテンツ */}
        <div className="space-y-6">
            {testExams.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto w-20 h-20 bg-[#8DCCB3] rounded-full flex items-center justify-center mb-6">
                  <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">まだ成績が登録されていません</h3>
                <p className="text-gray-600 mb-6">「新しい試験」ボタンから成績を追加してください</p>
                <button
                  onClick={() => initializeForm()}
                  className="bg-[#8DCCB3] hover:bg-[#5FA084] text-white px-8 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  最初の試験を追加
                </button>
              </div>
            ) : (
              <div className="grid gap-6">
                {testExams.map((exam, examIndex) => {
                  const previousExam = examIndex < testExams.length - 1 ? testExams[examIndex + 1] : null
                  return (
                    <div key={examIndex} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border-l-4 border-[#8DCCB3]">
                      {/* 試験ヘッダー */}
                      <div className="bg-[#8DCCB3] p-4 text-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-bold">{exam.test_period}</h3>
                            <p className="text-sm opacity-90">
                              {exam.test_date ? new Date(exam.test_date).toLocaleDateString('ja-JP') : '日付未設定'}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => initializeForm(exam)}
                              className="bg-white text-[#8DCCB3] px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 shadow-sm"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => deleteExam(exam)}
                              className="bg-gray-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 科目一覧 */}
                      <div className="p-4 md:p-6">
                        <div className="grid grid-cols-2 gap-2">
                          {exam.subjects.map((subject, subjectIndex) => {
                            const previousSubject = previousExam?.subjects.find(s => s.subject === subject.subject)
                            const scoreDifference = previousSubject ? Math.round((subject.score - previousSubject.score) * 10) / 10 : null
                            const rankDifference = (previousSubject && subject.student_rank && previousSubject.student_rank) 
                              ? previousSubject.student_rank - subject.student_rank : null
                            
                            return (
                              <div
                                key={subjectIndex}
                                className="bg-white rounded-lg border-2 border-gray-300 p-3 shadow-sm"
                              >
                                {/* 科目名 */}
                                <h4 className="font-bold text-xs text-gray-800 mb-1 text-center truncate">{subject.subject}</h4>
                                
                                {/* メイン情報エリア */}
                                <div className="space-y-4">
                                  {/* 点数エリア */}
                                  <div>
                                    <div className="flex items-baseline justify-center space-x-2 mb-2">
                                      <span className="text-2xl font-bold text-gray-800">{subject.score}</span>
                                      <span className="text-sm text-gray-500">点</span>
                                      {scoreDifference !== null && (
                                        <span className={`text-sm font-bold ${
                                          scoreDifference > 0 ? 'text-green-600' : 
                                          scoreDifference < 0 ? 'text-red-600' : 'text-gray-500'
                                        }`}>
                                          ({scoreDifference > 0 ? '+' : ''}{scoreDifference}
                                          {scoreDifference > 0 ? '↑' : scoreDifference < 0 ? '↓' : '→'})
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-400 text-center bg-gray-50 rounded px-2 py-1">
                                      {subject.class_average ? `平均 ${subject.class_average}点` : '平均 未入力'}
                                    </div>
                                  </div>
                                  
                                  {/* 順位エリア */}
                                  <div>
                                    <div className="flex items-baseline justify-center space-x-2">
                                      {subject.student_rank ? (
                                        <>
                                          <span className={`text-xl font-bold ${
                                            subject.student_rank <= 3 ? 'text-yellow-600' :
                                            subject.student_rank <= 10 ? 'text-gray-700' :
                                            'text-gray-600'
                                          }`}>
                                            {subject.student_rank}
                                          </span>
                                          <span className="text-sm text-gray-500">位</span>
                                          {rankDifference !== null && (
                                            <span className={`text-sm font-bold ${
                                              rankDifference > 0 ? 'text-green-600' : 
                                              rankDifference < 0 ? 'text-red-600' : 'text-gray-500'
                                            }`}>
                                              ({rankDifference > 0 ? '+' : ''}{rankDifference}
                                              {rankDifference > 0 ? '↑' : rankDifference < 0 ? '↓' : '→'})
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-xl font-bold text-gray-400">-</span>
                                          <span className="text-sm text-gray-500">位</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
        </div>
      </main>
    </div>
  )
}