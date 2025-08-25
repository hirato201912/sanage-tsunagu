import { supabase } from './supabase'
import type { RecurringSchedule } from './supabase'

/**
 * 定期スケジュールから指定期間の個別スケジュールを生成する
 */
export async function generateSchedulesFromRecurring(
  recurringSchedule: RecurringSchedule,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  const schedules = []
  const startDate = new Date(Math.max(
    new Date(recurringSchedule.start_date).getTime(),
    periodStart.getTime()
  ))
  
  const endDate = recurringSchedule.end_date 
    ? new Date(Math.min(
        new Date(recurringSchedule.end_date).getTime(),
        periodEnd.getTime()
      ))
    : periodEnd

  // 開始日から最初の該当曜日を見つける
  let currentDate = new Date(startDate)
  const targetDayOfWeek = recurringSchedule.day_of_week
  
  // 最初の該当曜日まで進める
  while (currentDate.getDay() !== targetDayOfWeek) {
    currentDate.setDate(currentDate.getDate() + 1)
  }

  // 終了日まで毎週該当曜日のスケジュールを生成
  while (currentDate <= endDate) {
    const scheduleDate = currentDate.toISOString().split('T')[0]
    
    // 既に存在するかチェック
    const { data: existing } = await supabase
      .from('schedules')
      .select('id')
      .eq('recurring_schedule_id', recurringSchedule.id)
      .eq('lesson_date', scheduleDate)
      .single()

    if (!existing) {
      schedules.push({
        student_id: recurringSchedule.student_id,
        instructor_id: recurringSchedule.instructor_id,
        lesson_type: recurringSchedule.lesson_type,
        subject: recurringSchedule.subject,
        lesson_date: scheduleDate,
        start_time: recurringSchedule.start_time,
        end_time: recurringSchedule.end_time,
        status: 'scheduled' as const,
        notes: recurringSchedule.notes,
        recurring_schedule_id: recurringSchedule.id
      })
    }

    // 次の週の同じ曜日に進める
    currentDate.setDate(currentDate.getDate() + 7)
  }

  // 一括挿入
  if (schedules.length > 0) {
    const { error } = await supabase
      .from('schedules')
      .insert(schedules)

    if (error) {
      console.error('Error generating schedules:', error)
      throw error
    }
  }
}

/**
 * 全ての定期スケジュールから指定期間のスケジュールを生成
 */
export async function generateAllRecurringSchedules(
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  try {
    // アクティブな定期スケジュールを取得
    const { data: recurringSchedules, error } = await supabase
      .from('recurring_schedules')
      .select('*')
      .eq('is_active', true)
      .or(`end_date.is.null,end_date.gte.${periodStart.toISOString().split('T')[0]}`)
      .lte('start_date', periodEnd.toISOString().split('T')[0])

    if (error) throw error

    // 各定期スケジュールから個別スケジュールを生成
    for (const recurringSchedule of recurringSchedules || []) {
      await generateSchedulesFromRecurring(recurringSchedule, periodStart, periodEnd)
    }

    console.log(`Generated schedules for ${recurringSchedules?.length || 0} recurring schedules`)
  } catch (error) {
    console.error('Error in generateAllRecurringSchedules:', error)
    throw error
  }
}

/**
 * 次の月のスケジュールを生成（管理者向け）
 */
export async function generateNextMonthSchedules(): Promise<void> {
  const today = new Date()
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const monthEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0)
  
  await generateAllRecurringSchedules(nextMonth, monthEnd)
}

/**
 * 指定期間のスケジュールを生成（柔軟な期間指定）
 */
export async function generateSchedulesForPeriod(weeks: number): Promise<void> {
  const today = new Date()
  const periodEnd = new Date(today)
  periodEnd.setDate(periodEnd.getDate() + (weeks * 7))
  
  await generateAllRecurringSchedules(today, periodEnd)
}

/**
 * 曜日番号を日本語に変換
 */
export function getDayOfWeekText(dayOfWeek: number): string {
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return days[dayOfWeek] || ''
}

/**
 * 定期スケジュールの表示用文字列を生成
 */
export function formatRecurringSchedule(schedule: RecurringSchedule): string {
  const dayText = getDayOfWeekText(schedule.day_of_week)
  const typeText = schedule.lesson_type === 'video' ? '映像' : '対面'
  return `${dayText}曜日 ${schedule.start_time}-${schedule.end_time} ${schedule.subject}(${typeText})`
}