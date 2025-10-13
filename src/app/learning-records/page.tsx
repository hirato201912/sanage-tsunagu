'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { StudySession, TestResult } from '@/lib/supabase'
import { 
  MdAccessTime, 
  MdAddCircle, 
  MdCalendarToday, 
  MdAssignment,
  MdSchool,
  MdTrendingUp,
  MdClose,
  MdPlayArrow,
  MdPause,
  MdStop,
  MdRefresh
} from 'react-icons/md'

export default function LearningRecordsPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [studySessions, setStudySessions] = useState<StudySession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showStudyForm, setShowStudyForm] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [showTestForm, setShowTestForm] = useState(false)

  // テスト結果フォーム用の状態
  const [testFormData, setTestFormData] = useState({
    test_name: '',
    subject: '',
    test_date: '',
    score: '',
    max_score: '',
    notes: ''
  })

  // ストップウォッチ用の状態
  const [stopwatchTime, setStopwatchTime] = useState(0) // 経過時間（秒）
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false)
  const [stopwatchInterval, setStopwatchInterval] = useState<NodeJS.Timeout | null>(null)

  // 学習時間記録フォーム用の状態
  const [studyFormData, setStudyFormData] = useState({
    subject: '',
    study_date: '',
    duration_minutes: '',
    notes: ''
  })


  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/login')
    }
  }, [user, profile, loading, router])

  useEffect(() => {
    if (profile) {
      fetchData()
    }
    // 初回マウント時にフォームの日付を設定
    const today = new Date().toISOString().split('T')[0]
    setStudyFormData(prev => ({ ...prev, study_date: today }))
    setTestFormData(prev => ({ ...prev, test_date: today }))
  }, [profile])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      
      let studentId = profile?.id
      
      // 塾長の場合は専用管理画面へリダイレクト
      if (profile?.role === 'admin') {
        router.push('/learning-admin')
        return
      }
      
      // 講師の場合は担当生徒の記録を表示（今回は実装を簡素化し、生徒のみアクセス可能とする）
      if (profile?.role === 'instructor') {
        setIsLoading(false)
        return
      }

      // 学習セッションを取得
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('student_id', studentId)
        .order('study_date', { ascending: false })

      if (sessionsError) throw sessionsError

      // テスト結果を取得
      const { data: testsData, error: testsError } = await supabase
        .from('test_results')
        .select('*')
        .eq('student_id', studentId)
        .order('test_date', { ascending: false })

      if (testsError) throw testsError

      setStudySessions(sessionsData || [])
      setTestResults(testsData || [])
    } catch (error) {
      console.error('Error fetching learning records:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStudySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase
        .from('study_sessions')
        .insert([{
          student_id: profile?.id,
          subject: studyFormData.subject,
          study_date: studyFormData.study_date,
          duration_minutes: Number(studyFormData.duration_minutes),
          notes: studyFormData.notes || null
        }])

      if (error) throw error

      // フォームリセット
      const today = new Date().toISOString().split('T')[0]
      setStudyFormData({
        subject: '',
        study_date: today,
        duration_minutes: '',
        notes: ''
      })

      setShowStudyForm(false)
      resetStopwatch() // ストップウォッチもリセット
      await fetchData()
      alert('学習記録を保存しました')
    } catch (error) {
      console.error('Error saving study session:', error)
      alert('学習記録の保存に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // 得点率を自動計算
      const score = Number(testFormData.score)
      const maxScore = Number(testFormData.max_score)
      const percentage = Math.round((score / maxScore) * 100)
      
      const { error } = await supabase
        .from('test_results')
        .insert([{
          student_id: profile?.id,
          test_name: testFormData.test_name,
          subject: testFormData.subject,
          test_date: testFormData.test_date,
          score: score,
          max_score: maxScore,
          percentage: percentage,
          notes: testFormData.notes || null
        }])

      if (error) throw error

      // フォームリセット
      const today = new Date().toISOString().split('T')[0]
      setTestFormData({
        test_name: '',
        subject: '',
        test_date: today,
        score: '',
        max_score: '',
        notes: ''
      })

      setShowTestForm(false)
      await fetchData()
      alert('テスト結果を保存しました')
    } catch (error) {
      console.error('Error saving test result:', error)
      alert('テスト結果の保存に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}時間${mins}分`
    }
    return `${mins}分`
  }

  // ストップウォッチの時間をフォーマット（HH:MM:SS形式）
  const formatStopwatchTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // ストップウォッチ開始
  const startStopwatch = () => {
    if (!isStopwatchRunning) {
      setIsStopwatchRunning(true)
      const interval = setInterval(() => {
        setStopwatchTime(prev => prev + 1)
      }, 1000)
      setStopwatchInterval(interval)
    }
  }

  // ストップウォッチ停止
  const stopStopwatch = () => {
    if (isStopwatchRunning && stopwatchInterval) {
      setIsStopwatchRunning(false)
      clearInterval(stopwatchInterval)
      setStopwatchInterval(null)
      
      // 学習時間フィールドに自動入力（分単位）
      const minutes = Math.ceil(stopwatchTime / 60)
      setStudyFormData(prev => ({ ...prev, duration_minutes: minutes.toString() }))
    }
  }

  // ストップウォッチリセット
  const resetStopwatch = () => {
    if (stopwatchInterval) {
      clearInterval(stopwatchInterval)
      setStopwatchInterval(null)
    }
    setIsStopwatchRunning(false)
    setStopwatchTime(0)
  }

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (stopwatchInterval) {
        clearInterval(stopwatchInterval)
      }
    }
  }, [stopwatchInterval])

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8DCCB3]"></div>
          <span className="text-[#4A5568]">読み込み中...</span>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  if (profile.role !== 'student') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center border border-[#8DCCB3]/10">
          <div className="mb-6">
            <MdSchool className="mx-auto h-16 w-16 text-[#8DCCB3]/50" />
          </div>
          <h2 className="text-xl font-bold text-[#4A5568] mb-4">
            {profile.role === 'admin' ? '管理者専用ページへ移動中...' : 'アクセス権限がありません'}
          </h2>
          <p className="text-gray-600 mb-6">
            {profile.role === 'admin' 
              ? '塾長は学習記録管理ページをご利用ください。' 
              : '学習記録機能は生徒のみ利用可能です。'}
          </p>
          <div className="flex flex-col space-y-3">
            {profile.role === 'admin' && (
              <button
                onClick={() => router.push('/learning-admin')}
                className="px-4 py-2 bg-[#8DCCB3] text-white rounded-lg hover:bg-[#5FA084] transition-all duration-200 font-medium"
              >
                学習記録管理へ
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 border border-[#8DCCB3]/30 text-[#8DCCB3] rounded-lg hover:bg-[#8DCCB3]/10 transition-all duration-200 font-medium"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </div>
    )
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
                <h1 className="text-2xl font-bold text-white">学習記録</h1>
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

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 今月の学習時間サマリー（簡素化） */}
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow-lg p-6 border border-[#8DCCB3]/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-[#8DCCB3]/10 rounded-full flex items-center justify-center">
                    <MdTrendingUp className="h-6 w-6 text-[#8DCCB3]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#4A5568]">今月の学習時間</h3>
                    <p className="text-sm text-gray-600">継続して頑張りましょう！</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#8DCCB3]">
                    {formatDuration(
                      studySessions
                        .filter(session => {
                          const sessionDate = new Date(session.study_date)
                          const now = new Date()
                          return sessionDate.getMonth() === now.getMonth() && 
                                 sessionDate.getFullYear() === now.getFullYear()
                        })
                        .reduce((total, session) => total + session.duration_minutes, 0)
                    )}
                  </div>
                  <div className="text-sm text-gray-500">月間合計</div>
                </div>
              </div>
            </div>
          </div>

          {/* 学習記録追加ボタン */}
          <div>
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-[#4A5568] flex items-center space-x-2">
                  <MdAccessTime className="text-[#8DCCB3]" />
                  <span>学習記録</span>
                </h2>
                <button
                  onClick={() => setShowStudyForm(true)}
                  className="flex items-center space-x-2 bg-[#8DCCB3] hover:bg-[#5FA084] text-white px-5 py-3 rounded-lg text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  <MdAddCircle className="h-5 w-5" />
                  <span>学習記録を追加</span>
                </button>
              </div>

              {/* 学習記録一覧 */}
              <div className="bg-white shadow-lg rounded-lg border border-[#8DCCB3]/10">
                {studySessions.length === 0 ? (
                  <div className="p-8 text-center">
                    <MdAccessTime className="mx-auto h-16 w-16 text-[#8DCCB3]/50 mb-4" />
                    <p className="text-gray-500 text-lg mb-2">まだ学習記録がありません</p>
                    <p className="text-gray-400 text-sm">「学習記録を追加」ボタンから記録を始めましょう</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {studySessions.map((session, index) => (
                      <div key={session.id} className={`p-6 ${index % 2 === 0 ? 'bg-white' : 'bg-[#8DCCB3]/5'} hover:bg-[#8DCCB3]/10 transition-all duration-200`}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#8DCCB3] text-white">
                                {session.subject}
                              </span>
                              <span className="text-sm text-gray-500 flex items-center">
                                <MdCalendarToday className="h-4 w-4 mr-1" />
                                {new Date(session.study_date).toLocaleDateString('ja-JP')}
                              </span>
                            </div>
                            {session.notes && (
                              <p className="text-gray-700 text-sm leading-relaxed">{session.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-[#8DCCB3] bg-white px-4 py-2 rounded-lg border border-[#8DCCB3]/20">
                            <MdAccessTime className="h-5 w-5" />
                            <span className="font-semibold">{formatDuration(session.duration_minutes)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* テスト結果タブは削除（別のテスト成績管理画面を使用） */}
          {false && (
            <div>
              {/* テスト結果追加ボタン */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-[#4A5568] flex items-center space-x-2">
                  <MdAssignment className="text-[#8DCCB3]" />
                  <span>テスト結果</span>
                </h2>
                <button
                  onClick={() => setShowTestForm(true)}
                  className="flex items-center space-x-2 bg-[#B8E0D0] hover:bg-[#8DCCB3] text-[#4A5568] hover:text-white px-5 py-3 rounded-lg text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  <MdAddCircle className="h-5 w-5" />
                  <span>テスト結果を追加</span>
                </button>
              </div>

              {/* テスト結果一覧 */}
              <div className="bg-white shadow-lg rounded-lg border border-[#8DCCB3]/10">
                {testResults.length === 0 ? (
                  <div className="p-8 text-center">
                    <MdAssignment className="mx-auto h-16 w-16 text-[#8DCCB3]/50 mb-4" />
                    <p className="text-gray-500 text-lg mb-2">まだテスト結果がありません</p>
                    <p className="text-gray-400 text-sm">「テスト結果を追加」ボタンから記録を始めましょう</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {testResults.map((result, index) => (
                      <div key={result.id} className={`p-6 ${index % 2 === 0 ? 'bg-white' : 'bg-[#8DCCB3]/5'} hover:bg-[#8DCCB3]/10 transition-all duration-200`}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#8DCCB3] text-white">
                                {result.subject}
                              </span>
                              <span className="text-sm text-gray-500 flex items-center">
                                <MdCalendarToday className="h-4 w-4 mr-1" />
                                {new Date(result.test_date).toLocaleDateString('ja-JP')}
                              </span>
                            </div>
                            <h4 className="font-semibold text-[#4A5568] mb-1">{result.test_name}</h4>
                            {result.notes && (
                              <p className="text-gray-700 text-sm leading-relaxed">{result.notes}</p>
                            )}
                          </div>
                          <div className="flex flex-col space-y-2">
                            <div className="bg-white px-4 py-2 rounded-lg border border-[#8DCCB3]/20 text-center">
                              <div className="text-lg font-bold text-[#4A5568]">
                                {result.score}点 / {result.max_score}点
                              </div>
                            </div>
                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium ${
                              result.percentage >= 80 ? 'bg-green-100 text-green-800' :
                              result.percentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {result.percentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 学習記録追加フォーム */}
      {showStudyForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md border border-[#8DCCB3]/10">
            <div className="px-6 py-4 border-b border-[#8DCCB3]/10">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-[#4A5568] flex items-center space-x-2">
                  <MdAccessTime className="text-[#8DCCB3]" />
                  <span>学習記録を追加</span>
                </h3>
                <button
                  onClick={() => {
                    setShowStudyForm(false)
                    resetStopwatch()
                  }}
                  className="text-gray-400 hover:text-[#8DCCB3] p-1 rounded-lg hover:bg-[#8DCCB3]/10 transition-all duration-200"
                >
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleStudySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-2">科目 *</label>
                <input
                  type="text"
                  required
                  value={studyFormData.subject}
                  onChange={(e) => setStudyFormData({ ...studyFormData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200"
                  placeholder="例：数学、英語、物理"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-2">学習日 *</label>
                <input
                  type="date"
                  required
                  value={studyFormData.study_date}
                  onChange={(e) => setStudyFormData({ ...studyFormData, study_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200"
                />
              </div>

              {/* ストップウォッチセクション */}
              <div className="bg-gradient-to-r from-[#8DCCB3]/10 to-[#B8E0D0]/10 p-6 rounded-xl border border-[#8DCCB3]/20">
                <div className="text-center mb-4">
                  <h4 className="text-lg font-semibold text-[#4A5568] mb-2 flex items-center justify-center space-x-2">
                    <MdAccessTime className="text-[#8DCCB3]" />
                    <span>学習タイマー</span>
                  </h4>
                  <div className="text-4xl font-mono font-bold text-[#8DCCB3] mb-4 bg-white px-6 py-3 rounded-lg shadow-inner border-2 border-[#8DCCB3]/20">
                    {formatStopwatchTime(stopwatchTime)}
                  </div>
                </div>
                
                <div className="flex justify-center space-x-3">
                  {!isStopwatchRunning ? (
                    <button
                      type="button"
                      onClick={startStopwatch}
                      className="flex items-center space-x-2 bg-[#8DCCB3] hover:bg-[#5FA084] text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                    >
                      <MdPlayArrow className="h-5 w-5" />
                      <span>開始</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopStopwatch}
                      className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                    >
                      <MdStop className="h-5 w-5" />
                      <span>停止</span>
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={resetStopwatch}
                    className="flex items-center space-x-2 bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                  >
                    <MdRefresh className="h-5 w-5" />
                    <span>リセット</span>
                  </button>
                </div>
                
                {stopwatchTime > 0 && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-[#4A5568]">
                      停止すると <span className="font-semibold text-[#8DCCB3]">{Math.ceil(stopwatchTime / 60)}分</span> が学習時間に自動入力されます
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-2">学習時間（分） *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={studyFormData.duration_minutes}
                  onChange={(e) => setStudyFormData({ ...studyFormData, duration_minutes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200"
                  placeholder="例：30, 60, 120（または上のタイマーを使用）"
                />
                <p className="text-xs text-gray-500 mt-1">上のタイマーを使うか、直接時間を入力してください</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-2">学習内容</label>
                <textarea
                  value={studyFormData.notes}
                  onChange={(e) => setStudyFormData({ ...studyFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200"
                  placeholder="学習した内容や感想など"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowStudyForm(false)
                    resetStopwatch()
                  }}
                  className="flex-1 px-4 py-2.5 border border-[#8DCCB3]/30 rounded-lg text-[#4A5568] hover:bg-[#8DCCB3]/10 hover:border-[#8DCCB3]/50 transition-all duration-200 font-medium"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-[#8DCCB3] text-white rounded-lg hover:bg-[#5FA084] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {isLoading ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* テスト結果追加フォーム */}
      {/* テスト結果フォームは削除（別のテスト成績管理画面を使用） */}
      {false && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md border border-[#8DCCB3]/10">
            <div className="px-6 py-4 border-b border-[#8DCCB3]/10">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-[#4A5568] flex items-center space-x-2">
                  <MdAssignment className="text-[#8DCCB3]" />
                  <span>テスト結果を追加</span>
                </h3>
                <button
                  onClick={() => setShowTestForm(false)}
                  className="text-gray-400 hover:text-[#8DCCB3] p-1 rounded-lg hover:bg-[#8DCCB3]/10 transition-all duration-200"
                >
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleTestSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-2">テスト名 *</label>
                <input
                  type="text"
                  required
                  value={testFormData.test_name}
                  onChange={(e) => setTestFormData({ ...testFormData, test_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200"
                  placeholder="例：中間テスト、期末テスト、小テスト"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-2">科目 *</label>
                <input
                  type="text"
                  required
                  value={testFormData.subject}
                  onChange={(e) => setTestFormData({ ...testFormData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200"
                  placeholder="例：数学、英語、物理"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-2">テスト日 *</label>
                <input
                  type="date"
                  required
                  value={testFormData.test_date}
                  onChange={(e) => setTestFormData({ ...testFormData, test_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#4A5568] mb-2">得点 *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.5"
                    value={testFormData.score}
                    onChange={(e) => setTestFormData({ ...testFormData, score: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200"
                    placeholder="例：85"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A5568] mb-2">満点 *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.5"
                    value={testFormData.max_score}
                    onChange={(e) => setTestFormData({ ...testFormData, max_score: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200"
                    placeholder="例：100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-2">備考</label>
                <textarea
                  value={testFormData.notes}
                  onChange={(e) => setTestFormData({ ...testFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200"
                  placeholder="テストの感想や反省点など"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTestForm(false)}
                  className="flex-1 px-4 py-2.5 border border-[#8DCCB3]/30 rounded-lg text-[#4A5568] hover:bg-[#8DCCB3]/10 hover:border-[#8DCCB3]/50 transition-all duration-200 font-medium"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-[#B8E0D0] text-[#4A5568] rounded-lg hover:bg-[#8DCCB3] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {isLoading ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}