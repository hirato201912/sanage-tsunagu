import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ツナグ',
    short_name: 'ツナグ',
    description: '学習管理システム',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#6BB6A8',
    icons: [
      {
        src: '/main_icon.png',
        sizes: 'any',
        type: 'image/png',
      },
      {
        src: '/main_icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/main_icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
