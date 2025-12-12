/**
 * ナビゲーション関連のユーティリティ関数
 * リロード時にページを復元するためのセッションストレージ管理
 */

const LAST_PAGE_KEY = 'tsunagu_last_page';

/**
 * 現在のページURLをセッションストレージに保存
 * @param pathname 保存するパス（例: '/dashboard', '/messages'）
 */
export function saveCurrentPage(pathname: string): void {
  if (typeof window === 'undefined') return;

  try {
    // ルートページとログインページは保存しない
    if (pathname === '/' || pathname === '/login') {
      return;
    }

    sessionStorage.setItem(LAST_PAGE_KEY, pathname);
  } catch (error) {
    console.error('Failed to save current page:', error);
  }
}

/**
 * セッションストレージから最後のページURLを取得し、削除
 * @returns 保存されていたパス、または null
 */
export function getAndClearLastPage(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const lastPage = sessionStorage.getItem(LAST_PAGE_KEY);

    if (lastPage) {
      // 取得後は削除（1回のみの復元）
      sessionStorage.removeItem(LAST_PAGE_KEY);
      return lastPage;
    }

    return null;
  } catch (error) {
    console.error('Failed to get last page:', error);
    return null;
  }
}

/**
 * 保存されているページ情報をクリア
 */
export function clearLastPage(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(LAST_PAGE_KEY);
  } catch (error) {
    console.error('Failed to clear last page:', error);
  }
}
