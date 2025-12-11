import { createClient } from '@supabase/supabase-js'

// 環境変数の取得（前後の空白を削除）
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

// デバッグ用：環境変数の状態を出力（本番環境でも確認できるように）
if (typeof window !== 'undefined') {
  console.log('🔍 Supabase環境変数のデバッグ情報:')
  console.log('URL exists:', !!supabaseUrl)
  console.log('URL length:', supabaseUrl?.length || 0)
  console.log('URL starts with https:', supabaseUrl?.startsWith('https://'))
  console.log('Key exists:', !!supabaseAnonKey)
  console.log('Key length:', supabaseAnonKey?.length || 0)

  // 完全なURLを表示（デバッグのため一時的に）
  if (supabaseUrl) {
    console.log('URL完全版:', supabaseUrl)
    console.log('URL文字コード:', Array.from(supabaseUrl).map(c => c.charCodeAt(0)))
  }

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://placeholder.supabase.co') {
    console.error('❌ Supabase環境変数が設定されていません！')
    console.error('Vercelの環境変数設定を確認してください:')
    console.error('- NEXT_PUBLIC_SUPABASE_URL')
    console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
}

// ビルド時のフォールバック（空文字の場合はプレースホルダーを使用）
const finalUrl = supabaseUrl || 'https://placeholder.supabase.co'
const finalKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder'

export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// 型定義（後で使用）
export type Profile = {
  id: string
  user_id: string
  full_name: string
  role: 'student' | 'instructor' | 'admin'
  classroom_id?: string
  grade?: '高1' | '高2' | '高3'  // 学年（生徒のみ）
  school_name?: string  // 高校名（生徒のみ）
  created_at: string
}

export type Schedule = {
  id: string
  student_id: string
  lesson_type: 'video' | 'face_to_face'
  subject: string
  lesson_date: string
  start_time: string
  end_time: string
  instructor_id?: string
  status: 'scheduled' | 'cancelled'
  notes?: string
  created_by?: string
  created_at: string
}

export type Message = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  image_url?: string
  image_filename?: string
  is_read: boolean
  read_at?: string
  created_at: string
}

export type RecurringSchedule = {
  id: string
  student_id: string
  instructor_id?: string
  lesson_type: 'video' | 'face_to_face'
  subject: string
  day_of_week: number // 0=日曜, 6=土曜
  start_time: string
  end_time: string
  start_date: string
  end_date?: string
  is_active: boolean
  notes?: string
  created_by?: string
  created_at: string
}

// 生徒の対面授業曜日設定
export type StudentLessonSetting = {
  id: string
  student_id: string
  day_of_week: number // 0=日曜, 1=月曜, ..., 6=土曜
  created_by: string
  created_at: string
  updated_at: string
}

// 学習タスク管理
export type LearningTask = {
  id: string
  student_id: string
  target_lesson_date: string // 対象の対面授業日（YYYY-MM-DD）
  period: 'before' | 'after' // before: それまでの1週間, after: これからの1週間
  title: string
  description?: string
  subject?: string
  order_index: number
  completed: boolean
  completed_at?: string
  completed_by?: string
  created_by: string
  created_at: string
  updated_at: string
}

export type TestResult = {
  id: string
  student_id: string
  test_name: string
  subject: string
  test_date: string
  score: number
  max_score: number
  percentage: number
  notes?: string
  created_at: string
  updated_at: string
}