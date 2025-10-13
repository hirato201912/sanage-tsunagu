'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { StudySession, Profile } from '@/lib/supabase'

interface StudySessionWithProfile extends StudySession {
  student: Profile
}

export default function LearningAdminPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [studySessions, setStudySessions] = useState<StudySessionWithProfile[]>([])
  const [students, setStudents] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<string>('all')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'all'>('month')
  const [searchKeyword, setSearchKeyword] = useState('')

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

      // 全生徒を取得
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('full_name')

      if (studentsError) throw studentsError

      // 全学習セッションを取得
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('study_sessions')
        .select(`
          *,
          student:student_id(id, full_name, role)
        `)
        .order('study_date', { ascending: false })

      if (sessionsError) throw sessionsError

      setStudents(studentsData || [])
      setStudySessions(sessionsData || [])
    } catch (error) {
      console.error('Error fetching learning records:', error)
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

  const getDateFilter = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    switch (dateRange) {
      case 'week':
        const weekAgo = new Date(today)
        weekAgo.setDate(today.getDate() - 7)
        return weekAgo
      case 'month':
        const monthAgo = new Date(today)
        monthAgo.setMonth(today.getMonth() - 1)
        return monthAgo
      case 'quarter':
        const quarterAgo = new Date(today)
        quarterAgo.setMonth(today.getMonth() - 3)
        return quarterAgo
      default:
        return null
    }
  }

  const filterStudySessions = () => {
    let filtered = studySessions

    // 生徒でフィルタ
    if (selectedStudent !== 'all') {
      filtered = filtered.filter(session => session.student.id === selectedStudent)
    }

    // 科目でフィルタ
    if (selectedSubject !== 'all') {
      filtered = filtered.filter(session => session.subject === selectedSubject)
    }

    // キーワード検索でフィルタ
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase().trim()
      filtered = filtered.filter(session =>
        session.notes?.toLowerCase().includes(keyword) ||
        session.subject.toLowerCase().includes(keyword) ||
        session.student.full_name.toLowerCase().includes(keyword)
      )
    }

    // 日付でフィルタ
    const dateFilter = getDateFilter()
    if (dateFilter) {
      filtered = filtered.filter(session => {
        const sessionDate = new Date(session.study_date)
        return sessionDate >= dateFilter
      })
    }

    return filtered
  }

  const filteredStudySessions = filterStudySessions()

  // 科目一覧の取得（学習セッションのみ）
  const subjects = Array.from(new Set(studySessions.map(session => session.subject))).sort()

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
      {/* 統一ヘッダー */}
      <header className="bg-[#6BB6A8] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-5">
            <div className="flex items-center space-x-3">
              <div className="bg-white rounded-xl p-2 shadow-md">
                <img src="/main_icon.png" alt="ツナグ" className="h-9 w-9" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">学習記録管理</h1>
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

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* 拡張フィルターセクション */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-[#8DCCB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
              </svg>
              検索・フィルター
            </h2>
            <button
              onClick={fetchData}
              className="inline-flex items-center px-4 py-2 bg-[#8DCCB3] hover:bg-[#5FA084] text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              更新
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">生徒で絞り込み</label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
              >
                <option value="all">全ての生徒</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">科目で絞り込み</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
              >
                <option value="all">全ての科目</option>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">期間で絞り込み</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
              >
                <option value="week">過去1週間</option>
                <option value="month">過去1ヶ月</option>
                <option value="quarter">過去3ヶ月</option>
                <option value="all">全期間</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">キーワード検索</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="学習内容、科目、生徒名で検索"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                />
                <svg className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* フィルター結果サマリー */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center">
                <span className="font-medium text-[#8DCCB3]">{filteredStudySessions.length}</span>
                <span className="ml-1">件の学習記録</span>
              </span>
              <span className="flex items-center">
                <span className="font-medium text-[#8DCCB3]">
                  {formatDuration(filteredStudySessions.reduce((sum, session) => sum + session.duration_minutes, 0))}
                </span>
                <span className="ml-1">の学習時間</span>
              </span>
            </div>
            {(selectedStudent !== 'all' || selectedSubject !== 'all' || dateRange !== 'all' || searchKeyword.trim()) && (
              <button
                onClick={() => {
                  setSelectedStudent('all')
                  setSelectedSubject('all')
                  setDateRange('month')
                  setSearchKeyword('')
                }}
                className="text-sm text-gray-500 hover:text-gray-700 underline hover:no-underline transition-colors"
              >
                フィルターをクリア
              </button>
            )}
          </div>
        </div>

        {/* 学習記録一覧セクション */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <svg className="w-6 h-6 mr-3 text-[#8DCCB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              学習記録一覧
            </h3>
          </div>

          <div className="p-6">
            {filteredStudySessions.length === 0 ? (
              <div className="text-center py-16">
                <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">学習記録が見つかりません</h3>
                <p className="text-gray-600 mb-4">検索条件を変更して再度お試しください</p>
                <button
                  onClick={() => {
                    setSelectedStudent('all')
                    setSelectedSubject('all')
                    setDateRange('month')
                    setSearchKeyword('')
                  }}
                  className="inline-flex items-center px-4 py-2 bg-[#8DCCB3] hover:bg-[#5FA084] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  フィルターをリセット
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredStudySessions.map((session) => {
                  const sessionDate = new Date(session.study_date)
                  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][sessionDate.getDay()]
                  const isRecent = (Date.now() - sessionDate.getTime()) < (7 * 24 * 60 * 60 * 1000) // 1週間以内

                  return (
                    <div
                      key={session.id}
                      className={`group bg-white border rounded-xl p-6 hover:shadow-md transition-all duration-200 ${
                        isRecent ? 'border-[#8DCCB3]/30 bg-[#8DCCB3]/5' : 'border-gray-200 hover:border-[#8DCCB3]/30'
                      }`}
                    >
                      {/* ヘッダー部分 */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              isRecent ? 'bg-[#8DCCB3] text-white' : 'bg-gray-100 text-gray-600'
                            }`}>
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="text-lg font-bold text-gray-900">{session.student.full_name}</h4>
                              {isRecent && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#8DCCB3] text-white">
                                  最近
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-3 text-sm text-gray-600">
                              <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {sessionDate.toLocaleDateString('ja-JP')} ({dayOfWeek})
                              </span>
                              <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {formatDuration(session.duration_minutes)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#B8E0D0]/20 text-[#5FA084] border border-[#B8E0D0]/30">
                            {session.subject}
                          </span>
                        </div>
                      </div>

                      {/* 学習内容 */}
                      {session.notes && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                          <div className="flex items-start space-x-2">
                            <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="min-w-0 flex-1">
                              <h5 className="text-sm font-semibold text-gray-900 mb-2">学習内容</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {session.notes}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 学習内容がない場合 */}
                      {!session.notes && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-center">
                          <p className="text-sm text-gray-500 italic">学習内容の記録なし</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}