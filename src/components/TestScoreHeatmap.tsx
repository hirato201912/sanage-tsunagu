'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'

interface TestScore {
  id: string
  student_id: string
  subject: string
  test_period: string
  test_date: string
  score: number
  max_score: number
  percentage: number
  class_average: number | null
  student_rank: number | null
  total_students: number | null
}

interface TestScoreWithProfile extends TestScore {
  student: Profile
}

interface ScoreComparison {
  student_id: string
  student_name: string
  subject: string
  current_score: number
  current_percentage: number
  previous_score: number | null
  previous_percentage: number | null
  difference: number | null
  test_periods: string[]
}

export default function TestScoreHeatmap() {
  const [testScores, setTestScores] = useState<TestScoreWithProfile[]>([])
  const [comparisons, setComparisons] = useState<ScoreComparison[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [subjects, setSubjects] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (testScores.length > 0) {
      calculateComparisons()
    }
  }, [testScores, selectedSubject, calculateComparisons])

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
        .order('test_date', { ascending: true })

      if (scoresError) throw scoresError

      setTestScores(scoresData || [])

      // 科目一覧を取得
      const uniqueSubjects = Array.from(new Set((scoresData || []).map(score => score.subject))).sort()
      setSubjects(uniqueSubjects)
      
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateComparisons = useCallback(() => {
    const filteredScores = selectedSubject === 'all'
      ? testScores
      : testScores.filter(score => score.subject === selectedSubject)

    const studentSubjectMap: { [key: string]: TestScore[] } = {}

    // 生徒・科目別にテスト結果をグループ化
    filteredScores.forEach(score => {
      const key = `${score.student_id}_${score.subject}`
      if (!studentSubjectMap[key]) {
        studentSubjectMap[key] = []
      }
      studentSubjectMap[key].push(score)
    })

    const comparisonResults: ScoreComparison[] = []

    Object.entries(studentSubjectMap).forEach(([, scores]) => {
      if (scores.length >= 1) {
        // 日付順にソート
        const sortedScores = scores.sort((a, b) => new Date(a.test_date).getTime() - new Date(b.test_date).getTime())
        const latest = sortedScores[sortedScores.length - 1]
        const previous = sortedScores.length > 1 ? sortedScores[sortedScores.length - 2] : null

        const currentPercentage = Math.round(latest.score)
        const previousPercentage = previous ? Math.round(previous.score) : null

        comparisonResults.push({
          student_id: latest.student_id,
          student_name: latest.student.full_name,
          subject: latest.subject,
          current_score: latest.score,
          current_percentage: currentPercentage,
          previous_score: previous?.score || null,
          previous_percentage: previousPercentage,
          difference: previousPercentage ? currentPercentage - previousPercentage : null,
          test_periods: sortedScores.map(s => s.test_period)
        })
      }
    })

    setComparisons(comparisonResults.sort((a, b) => a.student_name.localeCompare(b.student_name)))
  }, [testScores, selectedSubject])

  const getHeatmapColor = (difference: number | null): string => {
    if (difference === null) return 'bg-gray-100 text-gray-700'
    
    if (difference > 15) return 'bg-green-600 text-white'
    if (difference > 10) return 'bg-green-500 text-white'
    if (difference > 5) return 'bg-green-400 text-white'
    if (difference > 0) return 'bg-green-200 text-green-800'
    if (difference === 0) return 'bg-gray-200 text-gray-700'
    if (difference > -5) return 'bg-red-200 text-red-800'
    if (difference > -10) return 'bg-red-400 text-white'
    if (difference > -15) return 'bg-red-500 text-white'
    return 'bg-red-600 text-white'
  }

  const getDifferenceText = (difference: number | null): string => {
    if (difference === null) return '初回'
    if (difference > 0) return `+${difference}`
    return `${difference}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">成績推移ヒートマップ</h3>
          <div className="flex items-center space-x-4">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">全科目</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* カラーレジェンド */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-2">得点率変化 (%)</div>
          <div className="flex items-center space-x-1 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-red-600 rounded"></div>
              <span>-15以下</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>-10〜-15</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-red-400 rounded"></div>
              <span>-5〜-10</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-red-200 rounded"></div>
              <span>-1〜-5</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-gray-200 rounded"></div>
              <span>±0</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-green-200 rounded"></div>
              <span>+1〜+5</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-green-400 rounded"></div>
              <span>+6〜+10</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>+11〜+15</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-green-600 rounded"></div>
              <span>+15以上</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-gray-100 rounded border"></div>
              <span>初回</span>
            </div>
          </div>
        </div>

        {comparisons.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            比較可能な成績データがありません
          </div>
        ) : (
          <>
            {/* デスクトップ表示 */}
            <div className="hidden md:block overflow-hidden">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">生徒名</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">科目</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">前回</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">今回</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">変化</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">試験履歴</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((comparison, index) => (
                    <tr key={`${comparison.student_id}_${comparison.subject}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {comparison.student_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {comparison.subject}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">
                        {comparison.previous_percentage ? `${comparison.previous_percentage}%` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          comparison.current_percentage >= 80 ? 'bg-green-100 text-green-800' :
                          comparison.current_percentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {comparison.current_percentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getHeatmapColor(comparison.difference)}`}>
                          {getDifferenceText(comparison.difference)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="max-w-xs overflow-hidden">
                          {comparison.test_periods.slice(-3).join(' → ')}
                          {comparison.test_periods.length > 3 && '...'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* モバイル表示 */}
            <div className="md:hidden space-y-4">
              {comparisons.map((comparison) => (
                <div key={`${comparison.student_id}_${comparison.subject}`} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium text-gray-900">{comparison.student_name}</div>
                      <div className="text-sm text-gray-600">{comparison.subject}</div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getHeatmapColor(comparison.difference)}`}>
                        {getDifferenceText(comparison.difference)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">前回</div>
                      <div className="font-medium">
                        {comparison.previous_percentage ? `${comparison.previous_percentage}%` : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">今回</div>
                      <div className="font-medium">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          comparison.current_percentage >= 80 ? 'bg-green-100 text-green-800' :
                          comparison.current_percentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {comparison.current_percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-600">
                      試験履歴: {comparison.test_periods.slice(-2).join(' → ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}