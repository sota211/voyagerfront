import { useEffect, useState, useRef } from "react";
import LatestScreenshotGrid from "./components/LatestScreenshotGrid";

export default function Home() {
  const [files, setFiles] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // テロップ用
  const [message, setMessage] = useState("");
  // 経過時間
  const [elapsedTime, setElapsedTime] = useState(0);

  const API_URL =
    "https://us-central1-voyager2025-471802.cloudfunctions.net/list-screenshots";

  // --- API fetch ---
  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => {
        if (data?.files?.length) {
          const sorted = [...data.files].sort((a: string, b: string) => {
            const fa = a.split("/").pop() ?? "";
            const fb = b.split("/").pop() ?? "";
            return fa < fb ? 1 : -1;
          });
          setFiles(sorted);
        }
      })
      .catch((err) => console.error("API fetch error:", err));
  }, []);

  // --- 経過時間をスクロールと独立して管理 ---
  useEffect(() => {
    if (files.length === 0) return;
    const start = Date.now();

    const id = setInterval(() => {
      setElapsedTime(Date.now() - start);
    }, 100); // 100msごとに更新

    return () => clearInterval(id);
  }, [files]);

  // --- 自動スクロール処理 ---
  useEffect(() => {
    if (!containerRef.current || files.length === 0) return;
    const el = containerRef.current;
    el.scrollTop = el.scrollHeight; // 最下部から開始

    const duration = 10000;
    const accelRatio = 0.3;
    const accelDuration = duration * accelRatio;
    const start = el.scrollTop;
    const distance = start;

    const vMax =
      distance /
      (duration * (1 - (2 / 3) * accelRatio));

    let startTime: number | null = null;

    function step(now: number) {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;

      // テロップは 0〜10000ms の間だけ
      if (elapsed >= 1000 && elapsed < 3000) {
        setMessage("Receiving signal...");
      } else if (elapsed >= 3000 && elapsed < 5000) {
        setMessage("Mission Elapsed Time synchronized.");
      } else if (elapsed >= 5000 && elapsed < 7000) {
        setMessage("Decoding transmissions...");
      } else if (elapsed >= 7000 && elapsed < 10000) {
        setMessage("Internet Voyager");
      } else {
        setMessage("");
      }

      // スクロール距離
      let traveled = 0;
      if (elapsed <= accelDuration) {
        const t = elapsed;
        traveled = (vMax / (accelDuration ** 2)) * (t ** 3) / 3;
      } else {
        const accelDistance = (vMax * accelDuration) / 3;
        traveled = accelDistance + vMax * (elapsed - accelDuration);
      }

      el.scrollTop = start - traveled;

      if (elapsed < duration) {
        requestAnimationFrame(step);
      } else {
        el.scrollTop = 0;
        setMessage(""); // スクロール終了後はテロップ消す
      }
    }

    requestAnimationFrame(step);
  }, [files]);

  // --- タイムスタンプ整形 ---
  function extractTimestampRaw(url: string): string | null {
    const fname = url.split("/").pop() ?? "";
    const m = fname.match(/_(\d{8}_\d{6})_/);
    return m ? m[1] : null;
  }

  function extractTimestampPretty(url: string): string {
    const raw = extractTimestampRaw(url);
    if (!raw) return "";
    const y = raw.slice(0, 4);
    const mo = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    const hh = raw.slice(9, 11);
    const mm = raw.slice(11, 13);
    const ss = raw.slice(13, 15);
    return `${y}-${mo}-${d} ${hh}:${mm}:${ss}`;
  }

  if (files.length === 0) {
    return (
      <main className="bg-black text-white h-screen flex items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  const latest = files[0];
  const latestTsRaw = extractTimestampRaw(latest) ?? new Date().toISOString();
  const others = files.slice(1);

  return (
    <main className="bg-black text-white min-h-screen flex justify-center relative">
      <div ref={containerRef} className="w-full h-screen overflow-y-auto">
        {/* 最新スクショ */}
        <div className="flex items-center justify-center w-screen h-screen relative overflow-hidden">
          {/* 背景映像 */}
          <video
            src="/background.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0"
          />

          {/* 13000ms以降に黒レイヤー + 最新スクショ */}
          {elapsedTime >= 13000 && (
            <>
              <div className="relative z-20 w-full h-full flex items-center justify-center">
                <LatestScreenshotGrid imageUrl={latest} timestamp={latestTsRaw} />
              </div>
            </>
          )}
        </div>

        {/* 過去スクショ */}
        <div className="grid grid-cols-3">
          {others.map((url) => (
            <div key={url} className="relative aspect-square bg-black flex">
              <img
                src={url}
                alt="screenshot"
                className="w-full h-full object-cover object-top"
              />
              <span className="absolute bottom-1 right-1 text-lg font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">
                {extractTimestampPretty(url)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* テロップ（0〜10000msのみ表示） */}
      {message && elapsedTime < 10000 && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <span className="text-3xl font-bold text-white bg-black/70 px-6 py-3 rounded-lg animate-pulse">
            {message}
          </span>
        </div>
      )}
    </main>
  );
}
