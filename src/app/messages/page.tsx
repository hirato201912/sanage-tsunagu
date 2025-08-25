'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Message, Profile } from '@/lib/supabase'

interface MessageWithSender extends Message {
  sender: Profile
  student: Profile
}

export default function MessagesPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null)
  const [students, setStudents] = useState<Profile[]>([])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (profile) {
      initializeChat()
      
      // リアルタイム購読
      const channel = supabase
        .channel('messages_realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        }, async (payload) => {
          console.log('New message received:', payload)
          
          // 現在選択中の生徒に関連するメッセージかチェック
          if (selectedStudent && payload.new.student_id === selectedStudent.id) {
            const { data: newMessage } = await supabase
              .from('messages')
              .select(`
                *,
                sender:sender_id(id, full_name, role),
                student:student_id(id, full_name, role)
              `)
              .eq('id', payload.new.id)
              .single()

            if (newMessage) {
              setMessages(prev => [...prev, newMessage])
              scrollToBottom()
            }
          }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [profile, selectedStudent])
const initializeChat = async () => {
  try {
    console.log('Initializing chat for profile:', profile)
    
    await fetchStudents()
    
    // 生徒の場合は自分を自動選択
    if (profile?.role === 'student') {
      console.log('Auto-selecting student profile')
      setSelectedStudent(profile)
      await fetchMessages(profile.id)
    } else {
      console.log('Admin/Instructor - waiting for student selection')
      // 塾長・講師の場合はローディングを終了
      setMessagesLoading(false)
    }
  } catch (error) {
    console.error('Error in initializeChat:', error)
    setMessagesLoading(false) // エラー時もローディング終了
  }
}

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('full_name')

      if (error) throw error
      setStudents(data || [])
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const fetchMessages = async (studentId: string) => {
    try {
      setMessagesLoading(true)
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(id, full_name, role),
          student:student_id(id, full_name, role)
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
      
      setTimeout(scrollToBottom, 100)
      
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setMessagesLoading(false)
    }
  }

  const scrollToBottom = () => {
    const messagesContainer = document.getElementById('messages-container')
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }
  }

  const handleStudentSelect = (student: Profile) => {
    setSelectedStudent(student)
    fetchMessages(student.id)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !profile || !selectedStudent) return

    setSending(true)
    try {
      const messageData = {
        sender_id: profile.id,
        student_id: selectedStudent.id, // 選択された生徒のID（必須）
        message_text: newMessage.trim(),
        message_type: 'individual' as const,
        receiver_id: null // グループメッセージ的な扱い
      }

      const { error } = await supabase
        .from('messages')
        .insert([messageData])

      if (error) {
        console.error('Insert error:', error)
        throw error
      }

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('メッセージの送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffHours < 24) {
      return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
      })
    } else {
      return date.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return '塾長'
      case 'instructor': return '講師'
      case 'student': return '生徒'
      default: return ''
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'instructor': return 'bg-blue-100 text-blue-800'
      case 'student': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading || messagesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>読み込み中...</div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <img 
                src="/main_icon.png" 
                alt="ツナグ" 
                className="h-8 w-8"
              />
              <h1 className="text-3xl font-bold text-gray-900">メッセージ</h1>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-600 hover:text-blue-800"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
            
            {/* 生徒選択サイドバー（塾長・講師のみ） */}
            {(profile.role === 'admin' || profile.role === 'instructor') && (
              <div className="lg:col-span-1 bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                  <h2 className="font-medium text-gray-900">生徒選択</h2>
                  <p className="text-sm text-gray-500">メッセージする生徒を選んでください</p>
                </div>
                <div className="overflow-y-auto max-h-96">
                  {students.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => handleStudentSelect(student)}
                      className={`w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                        selectedStudent?.id === student.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="font-medium text-sm">{student.full_name}</div>
                      <div className="text-xs text-gray-500">生徒</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* メッセージエリア */}
            <div className={`${profile.role === 'student' ? 'lg:col-span-4' : 'lg:col-span-3'} bg-white rounded-lg shadow flex flex-col`}>
              
              {/* ヘッダー */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">
                    {selectedStudent ? (
                      <>
                        {selectedStudent.full_name}さんの学習サポート
                        <div className="text-sm text-gray-500 mt-1">
                          塾長・講師・{selectedStudent.full_name}さんが参加
                        </div>
                      </>
                    ) : (
                      'メッセージ'
                    )}
                  </h3>
                  <div className="text-sm text-gray-500">
                    {profile.full_name}さん（{getRoleText(profile.role)}）
                  </div>
                </div>
              </div>

              {/* メッセージ一覧 */}
              <div 
                id="messages-container"
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {!selectedStudent ? (
                  <div className="text-center text-gray-500 mt-8">
                    <div className="mb-4">👥</div>
                    <div>
                      {profile.role === 'student' 
                        ? 'あなた専用の学習サポートチャットです' 
                        : '生徒を選択してメッセージを開始してください'}
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <div className="mb-4">💬</div>
                    <div>まだメッセージがありません</div>
                    <div className="text-sm">最初のメッセージを送ってみましょう！</div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className="flex flex-col space-y-1">
                      
                      {/* 送信者情報 */}
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(message.sender.role)}`}>
                          {getRoleText(message.sender.role)}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {message.sender.full_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                      
                      {/* メッセージ内容 */}
                      <div className="ml-4">
                        <div className={`rounded-lg px-4 py-3 max-w-2xl ${
                          message.sender_id === profile.id 
                            ? 'bg-blue-100 ml-auto' 
                            : 'bg-gray-100'
                        }`}>
                          <div className="text-gray-900 whitespace-pre-wrap">
                            {message.message_text}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* メッセージ入力 */}
              {selectedStudent && (
                <div className="p-4 border-t bg-gray-50">
                  <div className="flex space-x-3">
                    <div className="flex-1">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        placeholder="メッセージを入力... (Enterで送信、Shift+Enterで改行)"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 self-start"
                    >
                      {sending ? '送信中...' : '送信'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}