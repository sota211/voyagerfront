// hooks/useImagePreload.ts
import { useEffect, useState } from "react";

/**
 * 画像URLを先読みして、可能なら decode() まで済ませる。
 * 戻り値: 読み込み完了（true/false）
 */
export function useImagePreload(url?: string | null) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    img.src = url;

    // decode() は対応ブラウザのみ。未対応なら load イベントで代替。
    const onDone = () => !cancelled && setReady(true);

    if ("decode" in img && typeof (img as any).decode === "function") {
      (img as any)
        .decode()
        .then(onDone)
        .catch(onDone); // エラーでもキャッシュに載る可能性があるのでreadyにする
    } else {
      img.onload = onDone;
      img.onerror = onDone;
    }

    return () => {
      cancelled = true;
    };
  }, [url]);

  return ready;
}
