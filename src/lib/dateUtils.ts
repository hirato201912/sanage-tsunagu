/**
 * 曜日から次回の対面授業日を計算するユーティリティ関数
 */

/**
 * 次回の対面授業日を取得
 * @param dayOfWeek 対面授業の曜日（0=日曜, 1=月曜, ..., 6=土曜）
 * @param baseDate 基準日（省略時は今日）
 * @returns 次回の対面授業日
 */
export function getNextLessonDate(dayOfWeek: number, baseDate: Date = new Date()): Date {
  const result = new Date(baseDate)
  result.setHours(0, 0, 0, 0)

  const currentDay = result.getDay()
  let daysUntilLesson = dayOfWeek - currentDay

  // 今日が対面授業の日の場合は今日を返す
  // それ以外で過去の曜日の場合は来週に進める
  if (daysUntilLesson < 0) {
    daysUntilLesson += 7
  }

  result.setDate(result.getDate() + daysUntilLesson)
  return result
}

/**
 * 前回の対面授業日を取得
 * @param dayOfWeek 対面授業の曜日（0=日曜, 1=月曜, ..., 6=土曜）
 * @param baseDate 基準日（省略時は今日）
 * @returns 前回の対面授業日
 */
export function getPreviousLessonDate(dayOfWeek: number, baseDate: Date = new Date()): Date {
  const result = new Date(baseDate)
  result.setHours(0, 0, 0, 0)

  const currentDay = result.getDay()
  let daysSinceLesson = currentDay - dayOfWeek

  // 今日が対面授業の日の場合は今日を返す
  // それ以外で未来の曜日の場合は先週に戻る
  if (daysSinceLesson < 0) {
    daysSinceLesson += 7
  }

  result.setDate(result.getDate() - daysSinceLesson)
  return result
}

/**
 * 次の次の対面授業日を取得（次回の1週間後）
 * @param dayOfWeek 対面授業の曜日
 * @param baseDate 基準日（省略時は今日）
 * @returns 次の次の対面授業日
 */
export function getNextNextLessonDate(dayOfWeek: number, baseDate: Date = new Date()): Date {
  const nextLesson = getNextLessonDate(dayOfWeek, baseDate)
  nextLesson.setDate(nextLesson.getDate() + 7)
  return nextLesson
}

/**
 * 日付をYYYY-MM-DD形式の文字列に変換
 */
export function formatDateToString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 日付を日本語形式で表示（例：11月20日（水））
 */
export function formatDateToJapanese(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
  const dayName = dayNames[date.getDay()]
  return `${month}月${day}日（${dayName}）`
}

/**
 * 曜日の数値を日本語に変換
 */
export function getDayName(dayOfWeek: number): string {
  const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']
  return dayNames[dayOfWeek] || ''
}

/**
 * 期間を表示用に整形（例：11/13（水）〜11/20（水））
 */
export function formatPeriod(startDate: Date, endDate: Date): string {
  return `${formatDateToJapanese(startDate)} 〜 ${formatDateToJapanese(endDate)}`
}
