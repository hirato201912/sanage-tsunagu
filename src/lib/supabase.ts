import { createClient } from '@supabase/supabase-js'
const supabaseUrl = "https://qloirbujquybrfaxwvqe.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsb2lyYnVqcXV5YnJmYXh3dnFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0OTYyNDYsImV4cCI6MjA3MTA3MjI0Nn0.bgcaRz3chwy8aAnHWgwrml2sEp1X8qA3Vw1MTNgIyVc"

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string
  created_at: string
}

export type Message = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
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
  created_at: string
}

export type StudySession = {
  id: string
  student_id: string
  subject: string
  study_date: string
  duration_minutes: number
  notes?: string
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