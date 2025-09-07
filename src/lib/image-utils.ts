export interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  maxSizeKB?: number
}

export const compressImage = (
  file: File,
  options: CompressOptions = {}
): Promise<File> => {
  const {
    maxWidth = 800,
    maxHeight = 600,
    quality = 0.8,
    maxSizeKB = 300
  } = options

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    if (!ctx) {
      reject(new Error('Canvas context not supported'))
      return
    }

    img.onload = () => {
      let { width, height } = img

      // アスペクト比を維持してリサイズ
      const aspectRatio = width / height
      
      if (width > maxWidth) {
        width = maxWidth
        height = width / aspectRatio
      }
      
      if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatio
      }

      canvas.width = width
      canvas.height = height

      // 背景を白に設定（透明背景対応）
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)
      
      // 画像を描画
      ctx.drawImage(img, 0, 0, width, height)

      // 圧縮を試行（品質を段階的に下げる）
      const tryCompress = (currentQuality: number) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Image compression failed'))
            return
          }

          const sizeKB = blob.size / 1024
          
          // 目標サイズ以下か、品質が最低値の場合は完了
          if (sizeKB <= maxSizeKB || currentQuality <= 0.3) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            // 品質を下げて再試行
            tryCompress(currentQuality - 0.1)
          }
        }, 'image/jpeg', currentQuality)
      }

      tryCompress(quality)
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    img.src = URL.createObjectURL(file)
  })
}

export const validateImageFile = (file: File): string | null => {
  // ファイル形式チェック
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return '対応していない画像形式です。JPEG、PNG、WebPのみ対応しています。'
  }

  // ファイルサイズチェック（元画像は10MB以下）
  const maxSizeMB = 10
  if (file.size > maxSizeMB * 1024 * 1024) {
    return `画像サイズが大きすぎます。${maxSizeMB}MB以下の画像を選択してください。`
  }

  return null
}

export const generateImagePath = (userId: string, fileName: string): string => {
  const timestamp = Date.now()
  const extension = fileName.split('.').pop() || 'jpg'
  return `${userId}/${timestamp}.${extension}`
}