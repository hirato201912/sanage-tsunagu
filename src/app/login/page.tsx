'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { MdEmail, MdLock, MdLogin } from 'react-icons/md'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { signIn, user, loading: authLoading } = useAuth()
  const router = useRouter()

  // 既にログイン済みの場合はダッシュボードへリダイレクト
  useEffect(() => {
    if (!authLoading && user) {
      console.log('✅ Already logged in, redirecting to dashboard')
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await signIn(email, password)
      if (error) throw error
      
      router.push('/dashboard')
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#8DCCB3]/10 via-white to-[#B8E0D0]/20">
      {/* 装飾的な背景要素 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#8DCCB3]/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#B8E0D0]/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-[#8DCCB3]/10">
          {/* ヘッダー部分 */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-[#8DCCB3]/20 rounded-full blur-lg"></div>
                <img 
                  src="/main_icon.png" 
                  alt="ツナグ" 
                  className="relative h-20 w-20 rounded-full border-2 border-[#8DCCB3]/30"
                />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">ツナグ</h1>
            <p className="text-gray-600 text-sm">ツナグ 猿投校にログイン</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* メールアドレス入力 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MdEmail className="h-5 w-5 text-[#8DCCB3]" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200 bg-gray-50 hover:bg-white"
                  placeholder="example@email.com"
                />
              </div>
            </div>

            {/* パスワード入力 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                パスワード
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MdLock className="h-5 w-5 text-[#8DCCB3]" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8DCCB3]/50 focus:border-[#8DCCB3] transition-all duration-200 bg-gray-50 hover:bg-white"
                  placeholder="パスワードを入力"
                />
              </div>
            </div>

            {/* エラーメッセージ */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}

            {/* ログインボタン */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[#8DCCB3] hover:bg-[#5FA084] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8DCCB3] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <MdLogin className="mr-2 h-5 w-5" />
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ログイン中...
                  </div>
                ) : (
                  'ログイン'
                )}
              </button>
            </div>
          </form>

          {/* フッター */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">
              © 2025 ツナグ 猿投校
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}