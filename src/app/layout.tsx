import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ツナグ - 学習管理アプリ',
  description: '映像授業と対面授業を効率的に管理',
  icons: [
    {
      rel: 'icon',
      url: '/main_icon.png',
      sizes: '32x32',
      type: 'image/png',
    },
    {
      rel: 'icon',
      url: '/main_icon.png',
      sizes: '16x16',
      type: 'image/png',
    },
    {
      rel: 'apple-touch-icon',
      url: '/main_icon.png',
      sizes: '180x180',
      type: 'image/png',
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="icon" href="/main_icon.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/main_icon.png" sizes="16x16" type="image/png" />
        <link rel="apple-touch-icon" href="/main_icon.png" sizes="180x180" />
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}