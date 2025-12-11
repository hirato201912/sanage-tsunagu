import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // デプロイ時にESLintエラーを無視
    ignoreDuringBuilds: true,
  },
  typescript: {
    // デプロイ時にTypeScriptエラーを無視（オプション）
    // 注意: 本番環境では型エラーがある可能性があります
    ignoreBuildErrors: true,
  },
  // 静的エクスポートを無効化（useSearchParams対応）
  output: undefined,
};

export default nextConfig;
