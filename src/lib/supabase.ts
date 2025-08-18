import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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