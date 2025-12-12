import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { saveCurrentPage } from '@/utils/navigation';

/**
 * 現在のページをセッションストレージに自動保存するカスタムフック
 * リロード時に同じページに戻れるようにする
 */
export function useSaveCurrentPage() {
  const pathname = usePathname();

  useEffect(() => {
    // ページがマウントされたら、現在のパスを保存
    saveCurrentPage(pathname);
  }, [pathname]);
}
