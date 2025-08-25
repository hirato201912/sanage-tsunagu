import { createClient } from '@supabase/supabase-js'
const supabaseUrl = "https://qloirbujquybrfaxwvqe.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsb2lyYnVqcXV5YnJmYXh3dnFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0OTYyNDYsImV4cCI6MjA3MTA3MjI0Nn0.bgcaRz3chwy8aAnHWgwrml2sEp1X8qA3Vw1MTNgIyVc"
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
  receiver_id?: string
  student_id: string
  message_text: string
  message_type: 'individual' | 'group' | 'system'
  is_read: boolean
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