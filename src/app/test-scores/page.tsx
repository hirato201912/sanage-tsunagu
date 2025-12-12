'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import TestScoreHeatmap from '@/components/TestScoreHeatmap'
import { useSaveCurrentPage } from '@/hooks/useSaveCurrentPage'

interface TestScore {
  id: string
  student_id: string
  subject: string
  test_period: string
  test_date: string | null
  score: number
  max_score: number
  class_average: number | null
  student_rank: number | null
  total_students: number | null
  previous_score: number | null
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
  const [testScores, setTestScores] = useState<TestScoreWithProfile[]>([])
  const [students, setStudents] = useState<Profile[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'list' | 'analysis'>('list')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [maxVisiblePeriods, setMaxVisiblePeriods] = useState(4)

  // リロード時にこのページに戻れるように保存
  useSaveCurrentPage()

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

  useEffect(() => {
    if (profile && profile.role === 'admin') {
      fetchStudents()
    }
  }, [profile])

  useEffect(() => {
    if (profile && profile.role === 'admin') {
      fetchData()
    }
  }, [selectedStudent, profile])

  const fetchStudents = async () => {
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'student')
        .order('full_name')

      if (studentsError) throw studentsError
      setStudents(studentsData || [])
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const fetchData = async () => {
    try {
      setIsLoading(true)

      // 生徒が入力したテスト成績を取得
      let query = supabase
        .from('test_scores')
        .select('*')
        .order('test_date', { ascending: false })

      // 特定の生徒が選択されている場合はフィルタリング
      if (selectedStudent !== '') {
        query = query.eq('student_id', selectedStudent)
      }

      const { data: scoresData, error: scoresError } = await query

      if (scoresError) throw scoresError

      // 生徒情報と成績データを組み合わせ
      if (scoresData && scoresData.length > 0) {
        const studentIds = [...new Set(scoresData.map(score => score.student_id))]
        const { data: studentProfiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('id', studentIds)

        if (profileError) throw profileError

        const studentsMap = new Map(studentProfiles?.map(student => [student.id, student]) || [])

        // 前回スコアを計算して追加
        const scoresWithPrevious = scoresData.map(score => {
          // 同じ科目で同じ生徒の過去のスコアを探す（日付順でソート）
          const sameSubjectScores = scoresData
            .filter(s => s.student_id === score.student_id && s.subject === score.subject && s.test_date)
            .sort((a, b) => new Date(b.test_date).getTime() - new Date(a.test_date).getTime())

          // 現在のスコアのインデックスを探す
          const currentIndex = sameSubjectScores.findIndex(s => s.id === score.id)

          // 前回のスコア（時系列で1つ前）があれば取得
          const previousScore = currentIndex >= 0 && currentIndex < sameSubjectScores.length - 1
            ? sameSubjectScores[currentIndex + 1]?.score
            : null

          return {
            ...score,
            previous_score: previousScore,
            student: studentsMap.get(score.student_id) || { id: score.student_id, full_name: '不明な生徒', role: 'student' }
          }
        })

        setTestScores(scoresWithPrevious)
      } else {
        setTestScores([])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 試験名ごとにテスト成績をグループ化
  const groupScoresByTestPeriod = (scores: TestScoreWithProfile[]) => {
    const grouped: { [key: string]: TestScoreWithProfile[] } = {}
    scores.forEach(score => {
      if (!grouped[score.test_period]) {
        grouped[score.test_period] = []
      }
      grouped[score.test_period].push(score)
    })
    
    // 各グループ内で日付順にソート
    Object.keys(grouped).forEach(testPeriod => {
      grouped[testPeriod].sort((a, b) => {
        if (!a.test_date || !b.test_date) return 0
        return new Date(b.test_date).getTime() - new Date(a.test_date).getTime()
      })
    })
    
    return grouped
  }

  const groupedScores = groupScoresByTestPeriod(testScores)
  const testPeriods = Object.keys(groupedScores).sort((a, b) => {
    // 最新のテスト日付でソート
    const latestA = groupedScores[a][0]?.test_date
    const latestB = groupedScores[b][0]?.test_date
    if (!latestA || !latestB) return 0
    
    const timeA = new Date(latestA).getTime()
    const timeB = new Date(latestB).getTime()
    
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
  })

  if (loading || isLoading) {
    return <LoadingScreen message="テスト成績を読み込んでいます" />
  }

  if (!user || !profile || profile.role !== 'admin') {
    return null
  }

  const generateChartData = (subject: string) => {
    const subjectScores = testScores
      .filter(score => score.subject === subject)
      .sort((a, b) => {
        if (!a.test_date || !b.test_date) return 0
        return new Date(a.test_date).getTime() - new Date(b.test_date).getTime()
      })

    return subjectScores.map(score => ({
      period: score.test_period,
      score: score.score,
      date: score.test_date,
      classAverage: score.class_average,
      rank: score.student_rank
    }))
  }

  const getHeatmapColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100

    if (percentage >= 90) return 'bg-green-500 text-white border-green-600'
    if (percentage >= 80) return 'bg-green-400 text-white border-green-500'
    if (percentage >= 70) return 'bg-green-300 text-gray-800 border-green-400'
    if (percentage >= 60) return 'bg-yellow-300 text-gray-800 border-yellow-400'
    if (percentage >= 50) return 'bg-orange-300 text-gray-800 border-orange-400'
    if (percentage >= 40) return 'bg-red-300 text-gray-800 border-red-400'
    return 'bg-red-500 text-white border-red-600'
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
                <h1 className="text-2xl font-bold text-white">テスト成績管理</h1>
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-2xl">
          <div className="px-4 py-5 sm:p-6">

            {/* 生徒選択セクション */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <svg className="w-4 h-4 inline mr-2 text-[#8DCCB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                生徒を選択してください
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {students.map(student => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student.id)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                      selectedStudent === student.id
                        ? 'border-[#8DCCB3] bg-[#8DCCB3]/10 text-[#5FA084] shadow-md'
                        : 'border-gray-200 bg-white hover:border-[#8DCCB3]/50 hover:bg-[#8DCCB3]/5 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        selectedStudent === student.id ? 'bg-[#8DCCB3]' : 'bg-gray-300'
                      }`} />
                      <span className="font-medium text-sm">{student.full_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* タブナビゲーション - 生徒選択時のみ表示 */}
            {selectedStudent && (
              <div className="border-b border-gray-200 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex space-x-8 mb-4 sm:mb-0">
                    <button
                      onClick={() => setActiveTab('list')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'list'
                          ? 'border-[#8DCCB3] text-[#8DCCB3]'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-[#8DCCB3]/30'
                      }`}
                    >
                      <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2zm0 0V3a2 2 0 012-2h2a2 2 0 012 2v2M7 5h10M7 5V3a2 2 0 012-2h2a2 2 0 012 2v2" />
                      </svg>
                      成績一覧
                    </button>
                    <button
                      onClick={() => setActiveTab('analysis')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'analysis'
                          ? 'border-[#8DCCB3] text-[#8DCCB3]'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-[#8DCCB3]/30'
                      }`}
                    >
                      <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                      成績推移グラフ
                    </button>
                  </div>
                  
                  {activeTab === 'list' && testScores.length > 0 && (
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-700">並び順:</span>
                      <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => setSortOrder('newest')}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            sortOrder === 'newest'
                              ? 'bg-[#8DCCB3] text-white'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                          新しい順
                        </button>
                        <button
                          onClick={() => setSortOrder('oldest')}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            sortOrder === 'oldest'
                              ? 'bg-[#8DCCB3] text-white'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                          古い順
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* コンテンツエリア */}
            {!selectedStudent ? (
              <div className="p-12 text-center">
                <div className="mx-auto w-20 h-20 bg-[#8DCCB3]/10 rounded-full flex items-center justify-center mb-6">
                  <svg className="h-10 w-10 text-[#8DCCB3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-xl mb-3">生徒を選択してください</p>
                <p className="text-gray-400 text-sm">上記から生徒を選択すると、その生徒のテスト成績を閲覧できます。</p>
              </div>
            ) : activeTab === 'list' && (
              <div>
                {testScores.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="mx-auto w-16 h-16 bg-[#8DCCB3]/10 rounded-full flex items-center justify-center mb-4">
                      <svg className="h-8 w-8 text-[#8DCCB3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-lg mb-2">選択した生徒の成績がありません</p>
                    <p className="text-gray-400 text-sm">生徒がマイ成績で入力すると、こちらに表示されます。</p>
                  </div>
                ) : (
                  // 成績一覧 - テストごとにまとめて表示
                  <div className="space-y-6">
                    {testPeriods.map(testPeriod => {
                      const scores = groupedScores[testPeriod]
                      const testDate = scores[0]?.test_date

                      // 合計点・平均点・最高点・最低点を計算
                      const totalScore = scores.reduce((sum, score) => sum + score.score, 0)
                      const totalMaxScore = scores.reduce((sum, score) => sum + score.max_score, 0)
                      const averagePercentage = Math.round((totalScore / totalMaxScore) * 100)
                      const bestScore = Math.max(...scores.map(s => s.score))
                      const worstScore = Math.min(...scores.map(s => s.score))

                      return (
                        <div key={testPeriod} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                          {/* テストヘッダー */}
                          <div className="bg-[#8DCCB3] px-6 py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <h4 className="text-xl font-bold text-white flex items-center">
                                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {testPeriod}
                                </h4>
                                <p className="text-white/90 text-sm mt-1">
                                  {testDate ? new Date(testDate).toLocaleDateString('ja-JP', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  }) : '日付未設定'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* 科目別成績カード */}
                          <div className="p-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                              {scores.map(score => {
                                const scoreDifference = score.previous_score ? score.score - score.previous_score : null
                                const scorePercentage = Math.round((score.score / score.max_score) * 100)

                                return (
                                  <div key={score.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:shadow-md transition-shadow">
                                    <div className="mb-3">
                                      <h5 className="font-bold text-gray-900 text-lg">{score.subject}</h5>
                                    </div>

                                    {/* コンパクトなスコア表示 */}
                                    <div className="flex items-center justify-center mb-3">
                                      <div className="text-3xl font-bold text-[#8DCCB3] mr-1">
                                        {score.score}
                                      </div>
                                      <div className="text-lg text-gray-600 mr-2">点</div>
                                      {/* 前回スコアとの比較表示 */}
                                      {score.previous_score ? (
                                        <div className="flex items-center">
                                          <div className={`text-2xl font-bold mr-1 ${
                                            scoreDifference > 0 ? 'text-green-600' :
                                            scoreDifference < 0 ? 'text-red-600' :
                                            'text-gray-400'
                                          }`}>
                                            {scoreDifference > 0 ? '↗' : scoreDifference < 0 ? '↘' : '→'}
                                          </div>
                                          <div className={`text-xs ${
                                            scoreDifference > 0 ? 'text-green-600' :
                                            scoreDifference < 0 ? 'text-red-600' :
                                            'text-gray-400'
                                          }`}>
                                            {scoreDifference > 0 ? '+' : ''}{scoreDifference}
                                          </div>
                                        </div>
                                      ) : (
                                        // 初回テストまたは前回スコアなし
                                        <div className="text-sm text-gray-400">
                                          初回
                                        </div>
                                      )}
                                    </div>

                                    {/* 進捗バー */}
                                    <div className="mb-3">
                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                          className="bg-[#8DCCB3] h-2 rounded-full transition-all duration-300"
                                          style={{ width: `${scorePercentage}%` }}
                                        />
                                      </div>
                                    </div>

                                    {/* 詳細情報 */}
                                    <div className="space-y-1 text-xs">
                                      {score.class_average && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-500">平均</span>
                                          <span className={`font-semibold ${
                                            score.score > score.class_average ? 'text-green-600' :
                                            score.score < score.class_average ? 'text-red-600' :
                                            'text-gray-600'
                                          }`}>
                                            {score.class_average.toFixed(1)}点 ({score.score > score.class_average ? '+' : ''}{(score.score - score.class_average).toFixed(1)})
                                          </span>
                                        </div>
                                      )}

                                      {score.student_rank && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-500">順位</span>
                                          <span className="font-semibold text-[#8DCCB3]">
                                            {score.student_rank}位{score.total_students && `/${score.total_students}`}
                                          </span>
                                        </div>
                                      )}
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
            )}

            {selectedStudent && activeTab === 'analysis' && (
              <div>
                {testScores.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="mx-auto w-16 h-16 bg-[#8DCCB3]/10 rounded-full flex items-center justify-center mb-4">
                      <svg className="h-8 w-8 text-[#8DCCB3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-lg mb-2">成績推移を分析するデータがありません</p>
                    <p className="text-gray-400 text-sm">複数回のテスト結果が必要です。</p>
                  </div>
                ) : (
                  // 科目別グラフ表示
                  <div className="space-y-6">
                    {(() => {
                      const subjects = [...new Set(testScores.map(score => score.subject))].sort()

                      return subjects.map(subject => {
                        const chartData = generateChartData(subject)

                        if (chartData.length < 2) {
                          return (
                            <div key={subject} className="bg-white p-6 rounded-lg border border-gray-200">
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <svg className="w-5 h-5 mr-2 text-[#8DCCB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                </svg>
                                {subject} - 成績推移
                              </h4>
                              <div className="text-center py-8">
                                <p className="text-gray-500">グラフを表示するには複数回のテスト結果が必要です</p>
                              </div>
                            </div>
                          )
                        }

                        // 100点満点として計算

                        return (
                          <div key={subject} className="bg-white p-6 rounded-lg border border-gray-200">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                              <svg className="w-5 h-5 mr-2 text-[#8DCCB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                              </svg>
                              {subject} - 成績推移
                            </h4>

                            {/* 改善されたグラフ表示 */}
                            <div className="relative bg-white p-6 rounded-lg border border-gray-200">

                              {/* グラフエリア */}
                              <div className="relative h-64 ml-12">
                                {/* Y軸ラベル */}
                                <div className="absolute -left-12 inset-y-0">
                                  {[0, 25, 50, 75, 100].map(value => (
                                    <div
                                      key={value}
                                      className="absolute text-sm text-gray-600 -translate-y-1/2"
                                      style={{ bottom: `${value}%` }}
                                    >
                                      {value}点
                                    </div>
                                  ))}
                                </div>

                                {/* グリッド線 */}
                                <div className="absolute inset-0">
                                  {[0, 25, 50, 75, 100].map(value => (
                                    <div
                                      key={value}
                                      className="absolute w-full border-t border-gray-200"
                                      style={{ bottom: `${value}%` }}
                                    />
                                  ))}
                                </div>

                                {/* 線グラフ */}
                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 256">
                                  {/* グラデーション定義 */}
                                  <defs>
                                    <linearGradient id={`gradient-${subject}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" style={{ stopColor: '#8DCCB3', stopOpacity: 0.3 }} />
                                      <stop offset="100%" style={{ stopColor: '#8DCCB3', stopOpacity: 0.05 }} />
                                    </linearGradient>
                                  </defs>

                                  {/* エリア塗りつぶし */}
                                  <path
                                    d={`M 0 256 ${chartData.map((data, index) => {
                                      const x = chartData.length > 1 ? (index / (chartData.length - 1)) * 400 : 0
                                      const y = 256 - ((data.score / 100) * 256)
                                      return `L ${isNaN(x) ? 0 : x} ${isNaN(y) ? 256 : y}`
                                    }).join(' ')} L 400 256 Z`}
                                    fill={`url(#gradient-${subject})`}
                                  />

                                  {/* クラス平均ライン */}
                                  {chartData.some(d => d.classAverage) && (
                                    <path
                                      d={chartData.map((data, index) => {
                                        const x = chartData.length > 1 ? (index / (chartData.length - 1)) * 400 : 0
                                        const y = data.classAverage ? 256 - ((data.classAverage / 100) * 256) : 256
                                        return `${index === 0 ? 'M' : 'L'} ${isNaN(x) ? 0 : x} ${isNaN(y) ? 256 : y}`
                                      }).join(' ')}
                                      stroke="#94a3b8"
                                      strokeWidth="2"
                                      strokeDasharray="5,5"
                                      fill="none"
                                      opacity="0.7"
                                    />
                                  )}

                                  {/* メインライン */}
                                  <path
                                    d={chartData.map((data, index) => {
                                      const x = chartData.length > 1 ? (index / (chartData.length - 1)) * 400 : 0
                                      const y = 256 - ((data.score / 100) * 256)
                                      return `${index === 0 ? 'M' : 'L'} ${isNaN(x) ? 0 : x} ${isNaN(y) ? 256 : y}`
                                    }).join(' ')}
                                    stroke="#8DCCB3"
                                    strokeWidth="3"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />

                                  {/* データポイント */}
                                  {chartData.map((data, index) => {
                                    const x = chartData.length > 1 ? (index / (chartData.length - 1)) * 400 : 0
                                    const y = 256 - ((data.score / 100) * 256)
                                    const isImprovement = index > 0 && data.score > chartData[index - 1].score
                                    const isDecline = index > 0 && data.score < chartData[index - 1].score

                                    return (
                                      <g key={index}>
                                        {/* 外側の円 */}
                                        <circle
                                          cx={isNaN(x) ? 0 : x}
                                          cy={isNaN(y) ? 256 : y}
                                          r="8"
                                          fill="white"
                                          stroke={
                                            isImprovement ? '#22c55e' :
                                            isDecline ? '#ef4444' :
                                            '#8DCCB3'
                                          }
                                          strokeWidth="3"
                                        />
                                        {/* 内側の円 */}
                                        <circle
                                          cx={isNaN(x) ? 0 : x}
                                          cy={isNaN(y) ? 256 : y}
                                          r="4"
                                          fill={
                                            isImprovement ? '#22c55e' :
                                            isDecline ? '#ef4444' :
                                            '#8DCCB3'
                                          }
                                        />
                                      </g>
                                    )
                                  })}
                                </svg>

                                {/* データポイントのツールチップ */}
                                {chartData.map((data, index) => {
                                  const x = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 0
                                  const y = 100 - (data.score)

                                  return (
                                    <div
                                      key={index}
                                      className="absolute group"
                                      style={{
                                        left: `${x}%`,
                                        top: `${y}%`,
                                        transform: 'translate(-50%, -50%)'
                                      }}
                                    >
                                      <div className="w-4 h-4 cursor-pointer" />
                                      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        <div className="font-semibold">{data.score}点</div>
                                        <div className="text-gray-300">{data.period}</div>
                                        {data.rank && (
                                          <div className="text-gray-300">順位: {data.rank}位</div>
                                        )}
                                        {data.classAverage && (
                                          <div className="text-gray-300">平均: {data.classAverage}点</div>
                                        )}
                                        {data.date && (
                                          <div className="text-gray-300">
                                            {new Date(data.date).toLocaleDateString('ja-JP')}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* X軸ラベル */}
                              <div className="flex justify-between mt-4 text-xs text-gray-600">
                                {chartData.map((data, index) => (
                                  <div key={index} className="text-center">
                                    <div className="font-medium">{data.period}</div>
                                    {data.date && (
                                      <div className="text-gray-400">
                                        {new Date(data.date).toLocaleDateString('ja-JP', {
                                          month: 'short',
                                          day: 'numeric'
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* 凡例 */}
                              <div className="flex items-center justify-center mt-4 space-x-6 text-xs">
                                <div className="flex items-center space-x-2">
                                  <div className="w-4 h-0.5 bg-[#8DCCB3]"></div>
                                  <span className="text-gray-600">個人成績</span>
                                </div>
                                {chartData.some(d => d.classAverage) && (
                                  <div className="flex items-center space-x-2">
                                    <div className="w-4 h-0.5 bg-gray-400 border-dashed border-t-2 border-gray-400"></div>
                                    <span className="text-gray-600">クラス平均</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}