'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, AuthResponse } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'

type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResponse>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 初期認証状態をチェック
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)

        if (session?.user) {
          await fetchProfile(session.user.id)
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

const fetchProfile = useCallback(async (userId: string, retryCount = 0): Promise<void> => {
  try {
    console.log('Fetching profile for userId:', userId)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    console.log('Profile query result:')
    console.log('Data:', data)
    console.log('Error:', error)

    if (error) {
      // JWT期限切れエラーの場合
      if (error.code === 'PGRST301' || error.code === 'PGRST302' || error.code === 'PGRST303') {
        console.log('JWT expired, attempting to refresh session...')

        // セッションを再取得してリトライ
        const { data: { session } } = await supabase.auth.getSession()
        if (session && retryCount < 2) {
          console.log('Session refreshed, retrying profile fetch...')
          return await fetchProfile(userId, retryCount + 1)
        } else {
          console.log('Session refresh failed, redirecting to login...')
          try {
            await supabase.auth.signOut()
          } catch (signOutError) {
            console.error('Error during sign out:', signOutError)
          }
          window.location.href = '/login'
          return
        }
      }

      console.error('Profile fetch error details:', error)

      // もしsingleでエラーが出る場合は、全件取得してみる
      const { data: allData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)

      console.log('All matching profiles:', allData)

      if (allData && allData.length > 0) {
        setProfile(allData[0])
      } else {
        console.error('No profile found for user:', userId)
        setProfile(null)
      }
      return
    } else {
      setProfile(data)
    }
  } catch (error) {
    console.error('Error fetching profile:', error)

    // ネットワークエラーなどの場合も再試行（最大2回まで）
    if (retryCount < 2) {
      console.log(`Retrying profile fetch... (attempt ${retryCount + 1})`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      return await fetchProfile(userId, retryCount + 1)
    } else {
      console.error('Max retry attempts reached, setting profile to null')
      setProfile(null)
    }
  }
}, [])

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setProfile(null)
    } catch (error) {
      console.error('Sign out error:', error)
      // エラーが発生してもプロファイルはクリアする
      setProfile(null)
      setUser(null)
    }
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}