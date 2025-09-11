'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Message, Profile } from '@/lib/supabase'
import { notificationService } from '@/lib/notifications'
import { compressImage, validateImageFile, generateImagePath } from '@/lib/image-utils'
import { MdSend, MdImage, MdClose } from 'react-icons/md'

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
      
      setTimeout(scrollToBottom, 100)
      
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
    const messagesContainer = document.getElementById('messages-container')
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }
  }

  const handleUserSelect = async (user: ConversationUser) => {
    const userProfile = { id: user.id, full_name: user.full_name, role: user.role } as Profile
    setSelectedUser(userProfile)
    await fetchMessages(user.id)
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const validationResult = validateImageFile(file)
    if (!validationResult.isValid) {
      alert(validationResult.error)
      return
    }

    setSelectedImage(file)
    
    // プレビュー表示
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeSelectedImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    // ファイル入力をクリア
    const fileInput = document.getElementById('image-input') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  }

  const uploadImage = async (file: File): Promise<{ url: string; originalSize: number; compressedSize: number }> => {
    try {
      setUploadingImage(true)
      
      const originalSize = file.size
      const compressedFile = await compressImage(file)
      const compressedSize = compressedFile.size
      const imagePath = generateImagePath(compressedFile.name)
      
      const { data, error } = await supabase.storage
        .from('message-images')
        .upload(imagePath, compressedFile)

      if (error) throw error

      const { data: publicUrlData } = supabase.storage
        .from('message-images')
        .getPublicUrl(imagePath)

      return { 
        url: publicUrlData.publicUrl,
        originalSize,
        compressedSize
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      throw error
    } finally {
      setUploadingImage(false)
    }
  }

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || sending || !profile || !selectedUser) return

    setSending(true)
    try {
      let imageUrl = null
      let imageFilename = null

      // 画像がある場合はアップロード
      if (selectedImage) {
        const uploadResult = await uploadImage(selectedImage)
        imageUrl = uploadResult.url
        imageFilename = selectedImage.name
        // サイズ情報をファイル名に含める形で保存
        imageFilename = `${selectedImage.name}|${uploadResult.originalSize}|${uploadResult.compressedSize}`
      }

      const messageData = {
        sender_id: profile.id,
        receiver_id: selectedUser.id,
        content: newMessage.trim() || '画像を送信しました',
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
        setTimeout(scrollToBottom, 100)
      }

      // フォームリセット
      setNewMessage('')
      removeSelectedImage()
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

  const formatFileSizeKB = (bytes: number) => {
    return Math.round(bytes / 1024) + 'KB'
  }

  const getImageSizeInfo = (message: MessageWithProfiles) => {
    if (!message.image_filename || !message.image_filename.includes('|')) return null
    try {
      const parts = message.image_filename.split('|')
      if (parts.length === 3) {
        return {
          original: parseInt(parts[1]),
          compressed: parseInt(parts[2])
        }
      }
    } catch {
      return null
    }
    return null
  }

  const getImageDisplayName = (message: MessageWithProfiles) => {
    if (!message.image_filename) return '画像'
    if (message.image_filename.includes('|')) {
      return message.image_filename.split('|')[0]
    }
    return message.image_filename
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
    <div className="min-h-screen bg-amber-50">
      <header className="bg-amber-100 border-b-2 border-amber-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <img 
                src="/main_icon.png" 
                alt="ツナグ" 
                className="h-12 w-12"
              />
              <div>
                <h1 className="text-3xl font-bold text-amber-900">学習サポートルーム</h1>
                <p className="text-sm text-amber-700 mt-1">生徒・講師・塾長の学習相談スペース</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2 text-amber-700 hover:text-amber-900 px-3 py-2 rounded-md transition-colors border border-amber-300 hover:bg-amber-200"
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
            <div className="lg:col-span-1 bg-white rounded-lg shadow-lg border border-amber-200">
              <div className="p-4 border-b border-amber-200 bg-amber-50">
                <h2 className="font-medium text-amber-900">学習相談相手</h2>
                <p className="text-sm text-amber-700">相談したい相手を選択</p>
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
                      className={`w-full text-left p-3 hover:bg-amber-50 border-b border-amber-100 transition-colors ${
                        selectedUser?.id === user.id ? 'bg-amber-100 border-amber-300' : ''
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
            <div className="lg:col-span-3 bg-white rounded-lg shadow-lg border border-amber-200 flex flex-col">
              
              {/* ヘッダー */}
              <div className="p-4 border-b border-amber-200 bg-amber-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-amber-900">
                      {selectedUser ? (
                        <>
                          {selectedUser.full_name}さんの学習サポートルーム
                          <div className="text-sm text-amber-700 mt-1">
                            {getRoleText(selectedUser.role)}との学習相談
                          </div>
                        </>
                      ) : (
                        '学習サポートルーム'
                      )}
                    </h3>
                  </div>
                  <div className="text-sm text-amber-700 bg-white px-3 py-1 rounded-full border border-amber-200">
                    {profile.full_name}（{getRoleText(profile.role)}）
                  </div>
                </div>
              </div>

              {/* メッセージ一覧 */}
              <div 
                id="messages-container"
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {!selectedUser ? (
                  <div className="text-center text-amber-700 mt-8 p-8 bg-amber-50 rounded-lg mx-4 border border-amber-200">
                    <svg className="mx-auto h-16 w-16 text-amber-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <div className="text-lg font-medium mb-2">学習相談を始めましょう</div>
                    <div className="text-sm">左から相談したい相手を選択してください</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-amber-700 mt-8 p-8 bg-amber-50 rounded-lg mx-4 border border-amber-200">
                    <svg className="mx-auto h-16 w-16 text-amber-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="text-lg font-medium mb-2">学習ノートの1ページ目</div>
                    <div className="text-sm">今日の学習で困ったことを相談してみましょう！</div>
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
                        <div className={`rounded-lg px-4 py-3 max-w-2xl border-2 ${
                          message.sender_id === profile.id 
                            ? 'bg-amber-100 ml-auto border-amber-300' 
                            : 'bg-white border-amber-200'
                        }`}>
                          <div className="text-amber-900 whitespace-pre-wrap">
                            {message.content}
                          </div>
                          {/* 画像表示 */}
                          {message.image_url && (
                            <div className="mt-2">
                              <img
                                src={message.image_url}
                                alt={message.image_filename || '添付画像'}
                                className="max-w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity border"
                                onClick={() => window.open(message.image_url!, '_blank')}
                              />
                              <div className="mt-1 p-2 bg-amber-50 rounded text-xs text-amber-700 border border-amber-200">
                                <div className="flex items-center space-x-2">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span>{getImageDisplayName(message)}</span>
                                </div>
                                {(() => {
                                  const sizeInfo = getImageSizeInfo(message)
                                  if (sizeInfo) {
                                    const compressionRatio = Math.round((1 - sizeInfo.compressed / sizeInfo.original) * 100)
                                    return (
                                      <div className="mt-1 text-xs text-amber-600">
                                        {formatFileSizeKB(sizeInfo.original)} → {formatFileSizeKB(sizeInfo.compressed)} 
                                        <span className="text-green-700 font-medium"> (-{compressionRatio}%)</span>
                                      </div>
                                    )
                                  }
                                  return <div className="mt-1 text-xs text-amber-600">圧縮済み</div>
                                })()}
                              </div>
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
                <div className="p-4 border-t border-amber-200 bg-amber-50 space-y-3">
                  {/* 画像プレビュー */}
                  {imagePreview && (
                    <div className="relative inline-block">
                      <img
                        src={imagePreview}
                        alt="アップロード予定の画像"
                        className="max-w-xs max-h-32 rounded border border-amber-300"
                      />
                      <button
                        type="button"
                        onClick={removeSelectedImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      >
                        <MdClose className="h-3 w-3" />
                      </button>
                      <div className="mt-1 p-2 bg-white rounded text-xs border border-amber-200">
                        <div className="text-amber-700 flex items-center space-x-1">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{selectedImage?.name}</span>
                        </div>
                        <div className="text-amber-600 mt-1">
                          {formatFileSizeKB(selectedImage?.size || 0)} → 圧縮後送信
                        </div>
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
                        placeholder="今日の学習で困ったことや質問を書いてください... (Enterで送信)"
                        rows={3}
                        className="w-full px-3 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white text-amber-900 placeholder-amber-600"
                      />
                    </div>
                    <div className="flex flex-col space-y-2">
                      {/* 画像選択ボタン */}
                      <input
                        id="image-input"
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <label
                        htmlFor="image-input"
                        className="flex items-center justify-center w-12 h-12 bg-white border border-amber-300 hover:bg-amber-100 text-amber-700 rounded-md cursor-pointer transition-colors"
                        title="画像を添付"
                      >
                        <MdImage className="h-5 w-5" />
                      </label>
                      
                      {/* 送信ボタン */}
                      <button
                        onClick={sendMessage}
                        disabled={(!newMessage.trim() && !selectedImage) || sending || uploadingImage}
                        className="flex items-center justify-center w-12 h-12 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors border border-amber-700"
                        title="送信"
                      >
                        {(sending || uploadingImage) ? (
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <MdSend className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {(sending || uploadingImage) && (
                    <div className="text-sm text-amber-700">
                      {uploadingImage ? '画像をアップロード中...' : '学習メモを送信中...'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}