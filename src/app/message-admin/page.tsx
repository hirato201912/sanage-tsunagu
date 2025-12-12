'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Message, Profile } from '@/lib/supabase'
import { useSaveCurrentPage } from '@/hooks/useSaveCurrentPage'

interface MessageWithProfiles extends Message {
  sender: Profile
  receiver: Profile
}

interface ConversationData {
  participants: [Profile, Profile]
  messages: MessageWithProfiles[]
  lastMessage: MessageWithProfiles
  unreadCount: number
}

export default function MessageAdminPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<ConversationData[]>([])
  const [selectedConversation, setSelectedConversation] = useState<ConversationData | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // リロード時にこのページに戻れるように保存
  useSaveCurrentPage()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (!loading && profile && profile.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, loading, profile, router])

  useEffect(() => {
    if (profile && profile.role === 'admin') {
      fetchAllConversations()
    }
  }, [profile])

  const fetchAllConversations = async () => {
    try {
      setMessagesLoading(true)
      
      // 全てのメッセージを取得
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(id, full_name, role),
          receiver:receiver_id(id, full_name, role)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // 会話をグループ化
      const conversationMap = new Map<string, MessageWithProfiles[]>()
      
      messages?.forEach((message) => {
        const senderId = message.sender.id
        const receiverId = message.receiver.id
        
        // 会話のキーを作成（IDの小さい方を前に）
        const conversationKey = senderId < receiverId 
          ? `${senderId}-${receiverId}` 
          : `${receiverId}-${senderId}`
        
        if (!conversationMap.has(conversationKey)) {
          conversationMap.set(conversationKey, [])
        }
        conversationMap.get(conversationKey)?.push(message)
      })

      // 会話データを構築
      const conversationData: ConversationData[] = []
      
      for (const [key, messageList] of conversationMap.entries()) {
        if (messageList.length === 0) continue
        
        // メッセージを時系列順にソート
        messageList.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        
        const lastMessage = messageList[messageList.length - 1]
        const participants: [Profile, Profile] = [
          messageList[0].sender.id < messageList[0].receiver.id 
            ? messageList[0].sender 
            : messageList[0].receiver,
          messageList[0].sender.id < messageList[0].receiver.id 
            ? messageList[0].receiver 
            : messageList[0].sender
        ]
        
        // 未読数を計算（管理者は全て既読として扱う）
        const unreadCount = messageList.filter(msg => !msg.is_read).length
        
        conversationData.push({
          participants,
          messages: messageList,
          lastMessage,
          unreadCount
        })
      }

      // 最新メッセージの時間順でソート
      conversationData.sort((a, b) => 
        new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
      )

      setConversations(conversationData)
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setMessagesLoading(false)
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
    } else if (diffHours < 24 * 7) {
      return date.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } else {
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
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

  const filteredConversations = conversations.filter(conv => {
    if (!searchTerm) return true
    
    const searchLower = searchTerm.toLowerCase()
    return (
      conv.participants[0].full_name.toLowerCase().includes(searchLower) ||
      conv.participants[1].full_name.toLowerCase().includes(searchLower) ||
      conv.lastMessage.content.toLowerCase().includes(searchLower)
    )
  })

  const scrollToBottom = (containerId: string) => {
    setTimeout(() => {
      const container = document.getElementById(containerId)
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }, 100)
  }

  useEffect(() => {
    if (selectedConversation) {
      scrollToBottom('admin-messages-container')
    }
  }, [selectedConversation])

  if (loading || messagesLoading) {
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
                <h1 className="text-3xl font-bold text-gray-900">メッセージ管理</h1>
                <p className="text-sm text-gray-600 mt-1">全ての会話を確認・管理</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/messages')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-sm font-medium">通常メッセージ</span>
              </button>
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
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src="/main_icon.png" 
                alt="ツナグ" 
                className="h-10 w-10 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  メッセージ管理
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  全ての会話を確認・管理
                </p>
              </div>
            </div>

            {/* ボタン部分 */}
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => router.push('/messages')}
                className="flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors bg-gray-50 hover:bg-gray-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-sm font-medium">通常メッセージ</span>
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors bg-gray-50 hover:bg-gray-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm font-medium">ダッシュボード</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
            
            {/* 会話一覧 */}
            <div className="lg:col-span-1 bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="font-medium text-gray-900">全会話一覧</h2>
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="参加者名やメッセージで検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <div className="overflow-y-auto max-h-96">
                {filteredConversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    会話がありません
                  </div>
                ) : (
                  filteredConversations.map((conversation, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                        selectedConversation === conversation ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(conversation.participants[0].role)}`}>
                              {getRoleText(conversation.participants[0].role)}
                            </span>
                            <span className="text-sm font-medium">{conversation.participants[0].full_name}</span>
                            <span className="text-gray-400">↔</span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(conversation.participants[1].role)}`}>
                              {getRoleText(conversation.participants[1].role)}
                            </span>
                            <span className="text-sm font-medium">{conversation.participants[1].full_name}</span>
                          </div>
                          <div className="text-xs text-gray-600 truncate">
                            最新: {conversation.lastMessage.content}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {formatTime(conversation.lastMessage.created_at)}
                          </div>
                        </div>
                        {conversation.unreadCount > 0 && (
                          <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center ml-2">
                            {conversation.unreadCount}
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* メッセージ詳細 */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow flex flex-col">
              
              {/* ヘッダー */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">
                    {selectedConversation ? (
                      <>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(selectedConversation.participants[0].role)}`}>
                            {getRoleText(selectedConversation.participants[0].role)}
                          </span>
                          <span>{selectedConversation.participants[0].full_name}</span>
                          <span className="text-gray-400">と</span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(selectedConversation.participants[1].role)}`}>
                            {getRoleText(selectedConversation.participants[1].role)}
                          </span>
                          <span>{selectedConversation.participants[1].full_name}</span>
                          <span>の会話</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          全 {selectedConversation.messages.length} 件のメッセージ
                        </div>
                      </>
                    ) : (
                      'メッセージ詳細'
                    )}
                  </h3>
                </div>
              </div>

              {/* メッセージ一覧 */}
              <div 
                id="admin-messages-container"
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {!selectedConversation ? (
                  <div className="text-center text-gray-500 mt-8">
                    <div className="mb-4">📋</div>
                    <div>左側から会話を選択してください</div>
                    <div className="text-sm">メッセージの詳細を確認できます</div>
                  </div>
                ) : selectedConversation.messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <div className="mb-4">📝</div>
                    <div>この会話にはまだメッセージがありません</div>
                  </div>
                ) : (
                  selectedConversation.messages.map((message) => (
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
                        {/* 既読状態 */}
                        <div className="flex items-center space-x-1">
                          {message.is_read ? (
                            <>
                              <svg className="h-3 w-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs text-blue-500 font-medium">
                                既読 {message.read_at && formatTime(message.read_at)}
                              </span>
                            </>
                          ) : (
                            <>
                              <svg className="h-3 w-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs text-gray-400">未読</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* メッセージ内容 */}
                      <div className="ml-4">
                        <div className="rounded-lg px-4 py-3 max-w-2xl bg-gray-100">
                          <div className="text-gray-900 whitespace-pre-wrap">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* フッター情報 */}
              {selectedConversation && (
                <div className="p-4 border-t bg-gray-50 text-center text-sm text-gray-600">
                  管理者として全会話を閲覧中
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}