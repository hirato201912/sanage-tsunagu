'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// ダミーデータ
const dummyStudents = [
  { id: '1', name: '山田太郎', faceToFaceDay: 3 }, // 水曜日
  { id: '2', name: '佐藤花子', faceToFaceDay: 5 }, // 金曜日
  { id: '3', name: '鈴木一郎', faceToFaceDay: 2 }, // 火曜日
]

const dummyData = {
  review: {
    // 前回の対面授業で設定した目標（生徒が取り組んだもの）
    tasks: [
      { id: '1', subject: '数学', description: '二次関数の問題集 p.20-30', isCompleted: true, notes: '全問正解できた' },
      { id: '2', subject: '英語', description: '単語帳 Unit 5-7 暗記', isCompleted: true, notes: '' },
      { id: '3', subject: '物理', description: '力学の復習ノート作成', isCompleted: false, notes: '時間が足りなかった' },
      { id: '4', subject: '化学', description: '元素記号 1-20 暗記', isCompleted: true, notes: '' },
    ],
    reviewComment: '今回もよく頑張りました。物理は時間が足りなかったようなので、次回は計画的に進めましょう。'
  },
  plan: {
    // 次回の対面授業までの目標（これから設定するもの）
    tasks: [
      { id: '1', subject: '数学', description: '三角関数の予習', isCompleted: false },
      { id: '2', subject: '英語', description: '長文読解 3題', isCompleted: false },
      { id: '3', subject: '物理', description: 'エネルギー保存則の問題演習', isCompleted: false },
    ],
    instructorComment: '次回は三角関数に入ります。予習をしっかりしておきましょう。'
  }
}

type Tab = 'review' | 'plan'

export default function LearningProgressPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [selectedStudent, setSelectedStudent] = useState('1')
  const [activeTab, setActiveTab] = useState<Tab>('review')
  const [reviewComment, setReviewComment] = useState(dummyData.review.reviewComment)
  const [planComment, setPlanComment] = useState(dummyData.plan.instructorComment)
  const [planTasks, setPlanTasks] = useState(dummyData.plan.tasks)

  useEffect(() => {
    console.log('learning-progress useEffect:', { loading, user: !!user, profile: profile?.role })

    // 一時的に認証チェックをスキップ（UI確認用）
    // if (!loading && (!user || !profile)) {
    //   router.push('/login')
    // } else if (!loading && profile && profile.role === 'student') {
    //   router.push('/dashboard')
    // }
  }, [user, profile, loading, router])

  // 一時的に認証チェックをスキップ（UI確認用）
  if (false && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8DCCB3]"></div>
          <span className="text-gray-600">読み込み中...</span>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-blue-600 hover:underline"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    )
  }

  // 一時的に認証チェックをスキップ（UI確認用）
  // if (!user || !profile) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gray-50">
  //       <div className="text-center">
  //         <p className="text-gray-600 mb-4">ログインしてください</p>
  //         <button
  //           onClick={() => router.push('/login')}
  //           className="bg-[#8DCCB3] text-white px-6 py-2 rounded-lg"
  //         >
  //           ログインページへ
  //         </button>
  //       </div>
  //     </div>
  //   )
  // }

  // if (profile?.role === 'student') {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gray-50">
  //       <div className="text-center">
  //         <p className="text-gray-600 mb-4">このページは講師・塾長専用です</p>
  //         <button
  //           onClick={() => router.push('/dashboard')}
  //           className="bg-[#8DCCB3] text-white px-6 py-2 rounded-lg"
  //         >
  //           ダッシュボードへ
  //         </button>
  //       </div>
  //     </div>
  //   )
  // }

  // 曜日名を取得
  const getDayName = (day: number) => {
    const days = ['日', '月', '火', '水', '木', '金', '土']
    return days[day]
  }

  // 選択中の生徒情報を取得
  const currentStudent = dummyStudents.find(s => s.id === selectedStudent)

  // 週の日付範囲を計算（ダミー表示用）
  const getWeekRangeText = () => {
    if (!currentStudent) return ''
    const dayName = getDayName(currentStudent.faceToFaceDay)
    return `（対面授業: ${dayName}曜日）`
  }

  const addPlanTask = () => {
    const newTask = {
      id: `new-${Date.now()}`,
      subject: '',
      description: '',
      isCompleted: false
    }
    setPlanTasks([...planTasks, newTask])
  }

  const updatePlanTask = (id: string, field: 'subject' | 'description', value: string) => {
    setPlanTasks(planTasks.map(task =>
      task.id === id ? { ...task, [field]: value } : task
    ))
  }

  const deletePlanTask = (id: string) => {
    setPlanTasks(planTasks.filter(task => task.id !== id))
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
                <h1 className="text-2xl font-bold text-white">学習進捗管理</h1>
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
        {/* 生徒選択 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-3">生徒を選択</label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors text-lg"
              >
                {dummyStudents.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-600 font-medium">
              {getWeekRangeText()}
            </div>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="bg-white rounded-t-xl shadow-sm border border-gray-200 border-b-0">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('review')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${
                activeTab === 'review'
                  ? 'bg-[#8DCCB3] text-white border-b-2 border-[#8DCCB3]'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              前回の振り返り
            </button>
            <button
              onClick={() => setActiveTab('plan')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${
                activeTab === 'plan'
                  ? 'bg-[#8DCCB3] text-white border-b-2 border-[#8DCCB3]'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              次回までの予定
            </button>
          </div>
        </div>

        {/* タブコンテンツ */}
        <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 p-6">
          {/* 振り返りタブ */}
          {activeTab === 'review' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">前回設定した目標の達成状況</h3>

                {/* タスク達成状況 */}
                <div className="space-y-3 mb-6">
                  {dummyData.review.tasks.map(task => (
                    <div key={task.id} className="bg-white rounded-lg p-4 border-2 border-gray-200">
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          {task.isCompleted ? (
                            <svg className="h-6 w-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="h-6 w-6 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                              {task.subject}
                            </span>
                            <span className={`text-sm font-semibold ${task.isCompleted ? 'text-gray-900' : 'text-gray-500'}`}>
                              {task.description}
                            </span>
                          </div>
                          {task.notes && (
                            <p className="text-sm text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                              メモ: {task.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* レビューコメント */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  講師のレビューコメント
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                  placeholder="先週の学習について振り返りコメントを記入してください"
                />
                <div className="mt-4 flex justify-end">
                  <button className="bg-[#8DCCB3] hover:bg-[#5FA084] text-white px-6 py-2.5 rounded-lg font-semibold transition-all shadow-md">
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 次回までの予定タブ */}
          {activeTab === 'plan' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">次回の対面授業までの学習目標</h3>

                {/* タスク作成 */}
                <div className="space-y-3 mb-6">
                  {planTasks.map((task, index) => (
                    <div key={task.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-3">
                          <input
                            type="text"
                            value={task.subject}
                            onChange={(e) => updatePlanTask(task.id, 'subject', e.target.value)}
                            placeholder="科目"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3]"
                          />
                        </div>
                        <div className="md:col-span-8">
                          <input
                            type="text"
                            value={task.description}
                            onChange={(e) => updatePlanTask(task.id, 'description', e.target.value)}
                            placeholder="タスク内容"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3]"
                          />
                        </div>
                        <div className="md:col-span-1 flex items-center justify-center">
                          <button
                            onClick={() => deletePlanTask(task.id)}
                            className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addPlanTask}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#8DCCB3] hover:text-[#8DCCB3] hover:bg-[#8DCCB3]/5 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-semibold">タスクを追加</span>
                  </button>
                </div>

                {/* 全体コメント */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    全体コメント
                  </label>
                  <textarea
                    value={planComment}
                    onChange={(e) => setPlanComment(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-[#8DCCB3] focus:border-[#8DCCB3] transition-colors"
                    placeholder="次回の対面授業までの学習について全体的なアドバイスを記入してください"
                  />
                  <div className="mt-4 flex justify-end">
                    <button className="bg-[#8DCCB3] hover:bg-[#5FA084] text-white px-6 py-2.5 rounded-lg font-semibold transition-all shadow-md">
                      保存
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
