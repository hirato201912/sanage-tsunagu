'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Message, Profile } from '@/lib/supabase'
import { notificationService } from '@/lib/notifications'
import { compressImage, validateImageFile, generateImagePath } from '@/lib/image-utils'

interface MessageWithProfiles extends Message {
  sender: Profile
  receiver: Profile
}

interface ConversationUser {
  id: string
  full_name: string
  role: string
  unread_count: number
}

export default function MessagesPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<MessageWithProfiles[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [availableUsers, setAvailableUsers] = useState<ConversationUser[]>([])
  const [notificationPermissionRequested, setNotificationPermissionRequested] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (profile) {
      initializeChat()
      // 通知許可を要求（初回のみ）
      requestNotificationPermission()
    }
  }, [profile])

  // メッセージリストが更新された時に最新メッセージへスクロール
  useEffect(() => {
    if (messages.length > 0 && selectedUser) {
      scrollToBottom()
    }
  }, [messages, selectedUser])

  const requestNotificationPermission = async () => {
    if (notificationPermissionRequested) return
    
    setNotificationPermissionRequested(true)
    if (notificationService.isSupported()) {
      await notificationService.requestPermission()
    }
  }

  useEffect(() => {
    if (profile && selectedUser) {
      // Supabase Realtimeの購読
      const channel = supabase
        .channel('messages_realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        }, async (payload) => {
          console.log('New message received:', payload)
          const newMessageData = payload.new as Message
          
          // 現在の会話に関連するメッセージかチェック
          if ((newMessageData.sender_id === profile.id && newMessageData.receiver_id === selectedUser.id) ||
              (newMessageData.sender_id === selectedUser.id && newMessageData.receiver_id === profile.id)) {
            
            // 自分が送信したメッセージの場合は重複追加を防ぐ
            const isOwnMessage = newMessageData.sender_id === profile.id
            if (isOwnMessage) {
              // 既に表示されているかチェック
              setMessages(prev => {
                const messageExists = prev.some(msg => msg.id === newMessageData.id)
                if (messageExists) {
                  return prev // 既に存在する場合は追加しない
                }
                
                // 存在しない場合は追加（フォールバック用）
                return [...prev, {
                  ...newMessageData,
                  sender: profile,
                  receiver: selectedUser
                } as MessageWithProfiles]
              })
            } else {
              // 相手からのメッセージの場合は取得して追加
              const { data: messageWithProfiles } = await supabase
                .from('messages')
                .select(`
                  *,
                  sender:sender_id(id, full_name, role),
                  receiver:receiver_id(id, full_name, role)
                `)
                .eq('id', newMessageData.id)
                .single()

              if (messageWithProfiles) {
                setMessages(prev => {
                  // 重複チェック
                  const messageExists = prev.some(msg => msg.id === messageWithProfiles.id)
                  if (messageExists) return prev
                  
                  return [...prev, messageWithProfiles]
                })
                scrollToBottom()
                
                // メッセージが自分宛ての場合、既読にする
                if (!newMessageData.is_read) {
                  await markAsRead(newMessageData.id)
                }

                // 通知を送信（ウィンドウがフォーカスされていない場合のみ）
                if (!document.hasFocus() && notificationService.isPermissionGranted()) {
                  notificationService.notifyNewMessage({
                    senderName: messageWithProfiles.sender.full_name,
                    content: messageWithProfiles.content,
                    onClick: () => {
                      // 通知クリック時の処理
                      window.focus()
                      scrollToBottom()
                    }
                  })
                }
              }
            }
          }
          
          // ユーザーリストの未読数を更新
          fetchAvailableUsers()
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages'
        }, () => {
          // 既読更新時もユーザーリスト更新
          fetchAvailableUsers()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [profile, selectedUser])

  const initializeChat = async () => {
    try {
      await fetchAvailableUsers()
      setMessagesLoading(false)
    } catch (error) {
      console.error('Error in initializeChat:', error)
      setMessagesLoading(false)
    }
  }

  const fetchAvailableUsers = async () => {
    if (!profile) return

    try {
      // 自分以外のユーザーを取得
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .neq('id', profile.id)

      if (error) throw error

      // 各ユーザーとの未読メッセージ数を取得
      const usersWithUnreadCount = await Promise.all(
        (users || []).map(async (user) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', user.id)
            .eq('receiver_id', profile.id)
            .eq('is_read', false)

          return {
            ...user,
            unread_count: count || 0
          }
        })
      )

      // 未読数順、その後名前順でソート
      usersWithUnreadCount.sort((a, b) => {
        if (a.unread_count !== b.unread_count) {
          return b.unread_count - a.unread_count
        }
        return a.full_name.localeCompare(b.full_name)
      })

      setAvailableUsers(usersWithUnreadCount)
    } catch (error) {
      console.error('Error fetching available users:', error)
    }
  }

  const fetchMessages = async (otherUserId: string) => {
    if (!profile) return

    try {
      setMessagesLoading(true)
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(id, full_name, role),
          receiver:receiver_id(id, full_name, role)
        `)
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${profile.id})`)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
      
      // 未読メッセージを既読にする
      const unreadMessages = (data || []).filter(msg => 
        msg.receiver_id === profile.id && !msg.is_read
      )
      
      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(msg => msg.id)
        await markMultipleAsRead(messageIds)
      }
      
      scrollToBottom()
      
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setMessagesLoading(false)
    }
  }

  const markAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', messageId)
    } catch (error) {
      console.error('Error marking message as read:', error)
    }
  }

  const markMultipleAsRead = async (messageIds: string[]) => {
    try {
      await supabase
        .from('messages')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .in('id', messageIds)
        
      fetchAvailableUsers() // 未読数更新
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      const messagesContainer = document.getElementById('messages-container')
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight
      }
    }, 100)
  }

  const handleUserSelect = async (user: ConversationUser) => {
    const userProfile = { id: user.id, full_name: user.full_name, role: user.role } as Profile
    setSelectedUser(userProfile)
    await fetchMessages(user.id)
    scrollToBottom()
  }

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // ファイルバリデーション
    const validationError = validateImageFile(file)
    if (validationError) {
      alert(validationError)
      return
    }

    try {
      // 画像圧縮
      const compressedFile = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.8,
        maxSizeKB: 300
      })

      setSelectedImage(compressedFile)
      
      // プレビュー用URL生成
      const previewUrl = URL.createObjectURL(compressedFile)
      setImagePreview(previewUrl)
      
      console.log(`圧縮完了: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB`)
    } catch (error) {
      console.error('Image compression error:', error)
      alert('画像の圧縮に失敗しました')
    }
  }

  const removeSelectedImage = () => {
    setSelectedImage(null)
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!profile) return null

    try {
      // 認証状態を確認
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      console.log('Auth user:', user)
      console.log('Profile:', profile)
      
      if (authError) {
        console.error('Auth error:', authError)
        throw authError
      }

      const imagePath = generateImagePath(profile.id, file.name)
      console.log('Upload path:', imagePath)
      
      const { error: uploadError } = await supabase.storage
        .from('message-images')
        .upload(imagePath, file)

      if (uploadError) {
        console.error('Upload error details:', uploadError)
        throw uploadError
      }

      const { data: urlData } = supabase.storage
        .from('message-images')
        .getPublicUrl(imagePath)

      return urlData.publicUrl
    } catch (error) {
      console.error('Image upload error:', error)
      throw error
    }
  }

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || sending || !profile || !selectedUser) return

    setSending(true)
    setUploadingImage(true)
    
    try {
      let imageUrl = null
      let imageFilename = null

      // 画像がある場合はアップロード
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage)
        imageFilename = selectedImage.name
      }

      const messageData = {
        sender_id: profile.id,
        receiver_id: selectedUser.id,
        content: newMessage.trim() || (selectedImage ? '画像を送信しました' : ''),
        image_url: imageUrl,
        image_filename: imageFilename,
        is_read: false
      }

      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select(`
          *,
          sender:sender_id(id, full_name, role),
          receiver:receiver_id(id, full_name, role)
        `)

      if (error) throw error

      // 送信したメッセージをすぐに表示に追加
      if (data && data[0]) {
        setMessages(prev => [...prev, data[0]])
        scrollToBottom()
      }

      setNewMessage('')
      removeSelectedImage()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('メッセージの送信に失敗しました')
    } finally {
      setSending(false)
      setUploadingImage(false)
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
                <h1 className="text-3xl font-bold text-gray-900">メッセージ</h1>
                <p className="text-sm text-gray-600 mt-1">リアルタイムコミュニケーション</p>
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
                  メッセージ
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  リアルタイム<br className="sm:hidden" />コミュニケーション
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
            
            {/* ユーザー選択サイドバー */}
            <div className="lg:col-span-1 bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="font-medium text-gray-900">連絡先</h2>
                <p className="text-sm text-gray-500">メッセージする相手を選択</p>
              </div>
              <div className="overflow-y-auto max-h-96">
                {availableUsers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    連絡可能なユーザーがいません
                  </div>
                ) : (
                  availableUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className={`w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                        selectedUser?.id === user.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-sm">{user.full_name}</div>
                          <div className="text-xs text-gray-500">{getRoleText(user.role)}</div>
                        </div>
                        {user.unread_count > 0 && (
                          <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                            {user.unread_count}
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* メッセージエリア */}
            <div className="lg:col-span-3 bg-white rounded-lg shadow flex flex-col">
              
              {/* ヘッダー */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">
                    {selectedUser ? (
                      <>
                        {selectedUser.full_name}さんとの会話
                        <div className="text-sm text-gray-500 mt-1">
                          {getRoleText(selectedUser.role)}
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
                {!selectedUser ? (
                  <div className="text-center text-gray-500 mt-8">
                    <div className="mb-4">💬</div>
                    <div>連絡先から相手を選択してください</div>
                    <div className="text-sm">メッセージのやり取りを開始できます</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <div className="mb-4">✨</div>
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
                        {/* 既読・未読表示（自分のメッセージのみ） */}
                        {message.sender_id === profile.id && (
                          <div className="flex items-center space-x-1">
                            {message.is_read ? (
                              <>
                                <svg className="h-3 w-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs text-blue-500 font-medium">
                                  既読 {message.read_at && `${formatTime(message.read_at)}`}
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
                        )}
                      </div>
                      
                      {/* メッセージ内容 */}
                      <div className="ml-4">
                        <div className={`rounded-lg px-4 py-3 max-w-2xl ${
                          message.sender_id === profile.id 
                            ? 'bg-blue-100 ml-auto' 
                            : 'bg-gray-100'
                        }`}>
                          {/* 画像がある場合は表示 */}
                          {message.image_url && (
                            <div className="mb-2">
                              <img 
                                src={message.image_url} 
                                alt={message.image_filename || '送信された画像'}
                                className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => {
                                  // 画像をクリックすると新しいタブで開く
                                  window.open(message.image_url, '_blank')
                                }}
                                onError={(e) => {
                                  // 画像読み込みエラー時の表示
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  const errorDiv = document.createElement('div')
                                  errorDiv.className = 'text-red-500 text-sm p-2 border border-red-200 rounded'
                                  errorDiv.textContent = '画像を読み込めませんでした'
                                  target.parentNode?.insertBefore(errorDiv, target)
                                }}
                              />
                              {message.image_filename && (
                                <div className="text-xs text-gray-500 mt-1">
                                  📎 {message.image_filename}
                                </div>
                              )}
                            </div>
                          )}
                          {/* テキストメッセージ */}
                          {message.content && (
                            <div className="text-gray-900 whitespace-pre-wrap">
                              {message.content}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* メッセージ入力 */}
              {selectedUser && (
                <div className="p-4 border-t bg-gray-50">
                  {/* 画像プレビュー */}
                  {imagePreview && (
                    <div className="mb-3 relative inline-block">
                      <img 
                        src={imagePreview} 
                        alt="選択された画像のプレビュー" 
                        className="max-w-48 max-h-32 rounded-lg border border-gray-300"
                      />
                      <button
                        onClick={removeSelectedImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                        title="画像を削除"
                      >
                        ×
                      </button>
                      <div className="text-xs text-gray-600 mt-1">
                        {selectedImage && (
                          <>
                            <span>{(selectedImage.size / 1024).toFixed(0)}KB</span>
                            <span className="ml-2 text-green-600">✅ 最適化済み</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  
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
                    
                    <div className="flex flex-col space-y-2">
                      {/* 画像選択ボタン */}
                      <label className="cursor-pointer bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-md text-sm flex items-center space-x-1 transition-colors">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>画像</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                      </label>
                      
                      {/* 送信ボタン */}
                      <button
                        onClick={sendMessage}
                        disabled={(!newMessage.trim() && !selectedImage) || sending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2 transition-colors"
                      >
                        {sending ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm">
                              {uploadingImage ? 'アップロード中...' : '送信中...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            <span className="text-sm">送信</span>
                          </>
                        )}
                      </button>
                    </div>
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