// 通知関連のユーティリティ関数

export class NotificationService {
  private static instance: NotificationService
  private permission: NotificationPermission = 'default'

  private constructor() {
    this.initializePermission()
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  private async initializePermission() {
    if ('Notification' in window) {
      this.permission = Notification.permission
    }
  }

  // 通知許可を要求
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('このブラウザは通知をサポートしていません')
      return false
    }

    if (this.permission === 'granted') {
      return true
    }

    if (this.permission === 'denied') {
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      this.permission = permission
      return permission === 'granted'
    } catch (error) {
      console.error('通知許可の取得に失敗:', error)
      return false
    }
  }

  // 通知を送信
  async sendNotification(options: {
    title: string
    body: string
    icon?: string
    tag?: string
    data?: Record<string, unknown>
    onClick?: () => void
  }): Promise<void> {
    if (this.permission !== 'granted') {
      console.warn('通知許可が得られていません')
      return
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/main_icon.png',
        tag: options.tag,
        data: options.data,
        requireInteraction: false // 自動で閉じる
      })

      // 通知がクリックされた時の処理
      if (options.onClick) {
        notification.onclick = () => {
          options.onClick!()
          notification.close()
          window.focus() // ブラウザウィンドウをフォーカス
        }
      }

      // 5秒後に自動的に閉じる
      setTimeout(() => {
        notification.close()
      }, 5000)

    } catch (error) {
      console.error('通知の送信に失敗:', error)
    }
  }

  // メッセージ通知
  async notifyNewMessage(options: {
    senderName: string
    content: string
    onClick?: () => void
  }) {
    await this.sendNotification({
      title: `新しいメッセージ - ${options.senderName}さんから`,
      body: options.content.length > 50 
        ? options.content.substring(0, 50) + '...' 
        : options.content,
      tag: 'new-message',
      onClick: options.onClick
    })
  }

  // 授業リマインダー通知
  async notifyLessonReminder(options: {
    lessonTitle: string
    timeUntil: string
    onClick?: () => void
  }) {
    await this.sendNotification({
      title: '授業開始のお知らせ',
      body: `${options.timeUntil}後に「${options.lessonTitle}」が始まります`,
      tag: 'lesson-reminder',
      onClick: options.onClick
    })
  }

  // 通知許可状態を取得
  isPermissionGranted(): boolean {
    return this.permission === 'granted'
  }

  // 通知がサポートされているかチェック
  isSupported(): boolean {
    return 'Notification' in window
  }
}

// シングルトンインスタンスをエクスポート
export const notificationService = NotificationService.getInstance()