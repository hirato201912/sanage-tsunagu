interface LoadingScreenProps {
  message?: string
  submessage?: string
}

export default function LoadingScreen({
  message = "準備しています",
  submessage = "少々お待ちください"
}: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#8DCCB3]/5 via-white to-[#B8E0D0]/10">
      <div className="text-center">
        {/* ロゴ画像 */}
        <div className="mb-6 animate-pulse">
          <img
            src="/main_icon.png"
            alt="ツナグ"
            className="h-24 w-24 mx-auto opacity-90"
          />
        </div>

        {/* ソフトなスピナー */}
        <div className="flex justify-center mb-4">
          <div className="flex gap-2">
            <div
              className="w-2 h-2 bg-[#6BB6A8] rounded-full animate-bounce"
              style={{animationDelay: '0ms'}}
            />
            <div
              className="w-2 h-2 bg-[#8DCCB3] rounded-full animate-bounce"
              style={{animationDelay: '150ms'}}
            />
            <div
              className="w-2 h-2 bg-[#B8E0D0] rounded-full animate-bounce"
              style={{animationDelay: '300ms'}}
            />
          </div>
        </div>

        {/* メッセージ */}
        <p className="text-gray-600 text-sm font-medium">{message}</p>
        <p className="mt-1 text-gray-400 text-xs">{submessage}</p>
      </div>
    </div>
  )
}
