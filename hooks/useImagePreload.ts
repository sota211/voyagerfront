// hooks/useImagePreload.ts
import { useEffect, useState } from "react";

/**
 * 画像URLを先読み。decode() 対応環境ではデコードまで済ませる。
 * 戻り値: 読み込み完了（true/false）
 */
export function useImagePreload(url?: string | null) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    const img = new Image();
    img.src = url;

    const done = () => {
      if (!cancelled) setReady(true);
    };

    const anyImg = img as any;
    if (typeof anyImg.decode === "function") {
      anyImg.decode().then(done).catch(done);
    } else {
      img.onload = done;
      img.onerror = done;
    }

    return () => { cancelled = true; };
  }, [url]);

  return ready;
}
