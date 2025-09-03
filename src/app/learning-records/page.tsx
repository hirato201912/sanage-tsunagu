'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { StudySession, TestResult } from '@/lib/supabase'

export default function LearningRecordsPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [studySessions, setStudySessions] = useState<StudySession[]>([])
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'study' | 'tests'>('study')
  const [showStudyForm, setShowStudyForm] = useState(false)
  const [showTestForm, setShowTestForm] = useState(false)

  // 学習時間記録フォーム用の状態
  const [studyFormData, setStudyFormData] = useState({
    subject: '',
    study_date: new Date().toISOString().split('T')[0],
    duration_minutes: 30,
    notes: ''
  })

  // テスト結果記録フォーム用の状態
  const [testFormData, setTestFormData] = useState({
    test_name: '',
    subject: '',
    test_date: new Date().toISOString().split('T')[0],
    score: 0,
    max_score: 100,
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
          duration_minutes: studyFormData.duration_minutes,
          notes: studyFormData.notes || null
        }])

      if (error) throw error

      // フォームリセット
      setStudyFormData({
        subject: '',
        study_date: new Date().toISOString().split('T')[0],
        duration_minutes: 30,
        notes: ''
      })

      setShowStudyForm(false)
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
      const { error } = await supabase
        .from('test_results')
        .insert([{
          student_id: profile?.id,
          test_name: testFormData.test_name,
          subject: testFormData.subject,
          test_date: testFormData.test_date,
          score: testFormData.score,
          max_score: testFormData.max_score,
          notes: testFormData.notes || null
        }])

      if (error) throw error

      // フォームリセット
      setTestFormData({
        test_name: '',
        subject: '',
        test_date: new Date().toISOString().split('T')[0],
        score: 0,
        max_score: 100,
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

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>読み込み中...</div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  if (profile.role !== 'student') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {profile.role === 'admin' ? '管理者専用ページへ移動中...' : 'アクセス権限がありません'}
          </h2>
          <p className="text-gray-600 mb-4">
            {profile.role === 'admin' 
              ? '塾長は学習記録管理ページをご利用ください。' 
              : '学習記録機能は生徒のみ利用可能です。'}
          </p>
          <div className="space-x-4">
            {profile.role === 'admin' && (
              <button
                onClick={() => router.push('/learning-admin')}
                className="text-blue-600 hover:text-blue-800"
              >
                学習記録管理へ
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-600 hover:text-blue-800"
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
      <header className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* デスクトップレイアウト */}
          <div className="hidden md:flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <img 
                src="/main_icon.png" 
                alt="ツナグ" 
                className="h-12 w-12"
              />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">学習記録</h1>
                <p className="text-sm text-gray-600 mt-1">自宅学習・テスト結果の記録・管理</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm font-medium">ダッシュボード</span>
              </button>
            </div>
          </div>

          {/* モバイルレイアウト */}
          <div className="md:hidden py-4">
            {/* タイトル部分 */}
            <div className="flex items-center space-x-3 mb-3">
              <img 
                src="/main_icon.png" 
                alt="ツナグ" 
                className="h-10 w-10 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  学習記録
                </h1>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  自宅学習・テスト結果の<br className="sm:hidden" />記録・管理
                </p>
              </div>
            </div>

            {/* ボタン部分 */}
            <div className="flex justify-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-900 px-4 py-2 rounded-md transition-colors bg-gray-50 hover:bg-gray-100 w-full max-w-xs"
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
                onClick={() => setActiveTab('study')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'study'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                自宅学習記録
              </button>
              <button
                onClick={() => setActiveTab('tests')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'tests'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                テスト結果
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 統計サマリー */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">今月の学習時間</dt>
                      <dd className="text-lg font-medium text-gray-900">
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
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">総学習回数</dt>
                      <dd className="text-lg font-medium text-gray-900">{studySessions.length}回</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">テスト受験回数</dt>
                      <dd className="text-lg font-medium text-gray-900">{testResults.length}回</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">平均得点率</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {testResults.length > 0 
                          ? `${Math.round(testResults.reduce((sum, result) => sum + result.percentage, 0) / testResults.length)}%`
                          : '0%'
                        }
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {activeTab === 'study' && (
            <div>
              {/* 学習記録追加ボタン */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">自宅学習記録</h2>
                <button
                  onClick={() => setShowStudyForm(true)}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>学習記録を追加</span>
                </button>
              </div>

              {/* 学習記録一覧 */}
              <div className="bg-white shadow rounded-lg">
                {studySessions.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    まだ学習記録がありません。「学習記録を追加」ボタンから記録を始めましょう。
                  </div>
                ) : (
                  <>
                    {/* デスクトップ表示（テーブル） */}
                    <div className="hidden md:block overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日付</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">学習時間</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">内容</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {studySessions.map((session) => (
                            <tr key={session.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(session.study_date).toLocaleDateString('ja-JP')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {session.subject}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDuration(session.duration_minutes)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                                <div className="truncate" title={session.notes || '-'}>
                                  {session.notes || '-'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* モバイル表示（カード） */}
                    <div className="md:hidden space-y-4 p-4">
                      {studySessions.map((session) => (
                        <div key={session.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {session.subject}
                                </span>
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <span className="flex items-center">
                                  <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {new Date(session.study_date).toLocaleDateString('ja-JP')}
                                </span>
                                <span className="flex items-center">
                                  <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {formatDuration(session.duration_minutes)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {session.notes && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="text-sm text-gray-700">
                                <div className="font-medium text-gray-900 mb-1">学習内容：</div>
                                <div className="whitespace-pre-wrap break-words">{session.notes}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tests' && (
            <div>
              {/* テスト結果追加ボタン */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">テスト結果</h2>
                <button
                  onClick={() => setShowTestForm(true)}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>テスト結果を追加</span>
                </button>
              </div>

              {/* テスト結果一覧 */}
              <div className="bg-white shadow rounded-lg">
                {testResults.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    まだテスト結果がありません。「テスト結果を追加」ボタンから記録を始めましょう。
                  </div>
                ) : (
                  <>
                    {/* デスクトップ表示（テーブル） */}
                    <div className="hidden md:block overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日付</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">テスト名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">点数</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">得点率</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">備考</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {testResults.map((result) => (
                            <tr key={result.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(result.test_date).toLocaleDateString('ja-JP')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {result.test_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {result.subject}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {result.score}点 / {result.max_score}点
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  result.percentage >= 80 ? 'bg-green-100 text-green-800' :
                                  result.percentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {result.percentage}%
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                                <div className="truncate" title={result.notes || '-'}>
                                  {result.notes || '-'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* モバイル表示（カード） */}
                    <div className="md:hidden space-y-4 p-4">
                      {testResults.map((result) => (
                        <div key={result.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {result.subject}
                                </span>
                              </div>
                              <div className="text-sm font-medium text-gray-900 mb-2">
                                {result.test_name}
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="flex items-center text-sm text-gray-600">
                                  <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {new Date(result.test_date).toLocaleDateString('ja-JP')}
                                </span>
                                <div className="text-right">
                                  <div className="text-sm font-medium text-gray-900">
                                    {result.score}点 / {result.max_score}点
                                  </div>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    result.percentage >= 80 ? 'bg-green-100 text-green-800' :
                                    result.percentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {result.percentage}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {result.notes && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="text-sm text-gray-700">
                                <div className="font-medium text-gray-900 mb-1">備考：</div>
                                <div className="whitespace-pre-wrap break-words">{result.notes}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 学習記録追加フォーム */}
      {showStudyForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">学習記録を追加</h3>
              <button
                onClick={() => setShowStudyForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleStudySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">科目 *</label>
                <input
                  type="text"
                  required
                  value={studyFormData.subject}
                  onChange={(e) => setStudyFormData({ ...studyFormData, subject: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例：数学、英語"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">学習日 *</label>
                <input
                  type="date"
                  required
                  value={studyFormData.study_date}
                  onChange={(e) => setStudyFormData({ ...studyFormData, study_date: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">学習時間（分） *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={studyFormData.duration_minutes}
                  onChange={(e) => setStudyFormData({ ...studyFormData, duration_minutes: Number(e.target.value) })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">学習内容</label>
                <textarea
                  value={studyFormData.notes}
                  onChange={(e) => setStudyFormData({ ...studyFormData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="学習した内容や感想など"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowStudyForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* テスト結果追加フォーム */}
      {showTestForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">テスト結果を追加</h3>
              <button
                onClick={() => setShowTestForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleTestSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">テスト名 *</label>
                <input
                  type="text"
                  required
                  value={testFormData.test_name}
                  onChange={(e) => setTestFormData({ ...testFormData, test_name: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  placeholder="例：中間テスト、期末テスト"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">科目 *</label>
                <input
                  type="text"
                  required
                  value={testFormData.subject}
                  onChange={(e) => setTestFormData({ ...testFormData, subject: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  placeholder="例：数学、英語"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">テスト日 *</label>
                <input
                  type="date"
                  required
                  value={testFormData.test_date}
                  onChange={(e) => setTestFormData({ ...testFormData, test_date: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">得点 *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={testFormData.score}
                    onChange={(e) => setTestFormData({ ...testFormData, score: Number(e.target.value) })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">満点 *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={testFormData.max_score}
                    onChange={(e) => setTestFormData({ ...testFormData, max_score: Number(e.target.value) })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">備考</label>
                <textarea
                  value={testFormData.notes}
                  onChange={(e) => setTestFormData({ ...testFormData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  placeholder="テストの感想や反省点など"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTestForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}