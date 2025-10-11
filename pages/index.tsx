import Head from "next/head";
import NextImage from "next/image"; // ← 別名に変更
import { useEffect, useRef, useState } from "react";
import LatestScreenshotGrid from "../components/LatestScreenshotGrid";

export default function Home() {
  const [latest, setLatest] = useState<string | null>(null);
  const [others, setOthers] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // テロップ用
  const [message, setMessage] = useState("");
  // 経過時間
  const [elapsedTime, setElapsedTime] = useState(0);

  const API_URL =
    "https://us-central1-voyager2025-471802.cloudfunctions.net/list-screenshots";

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

  // --- 経過時間をカウント（演出タイミングは従来通り） ---
  useEffect(() => {
    if (!latest) return;
    const start = Date.now();
    const id = setInterval(() => setElapsedTime(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [latest]);

  // --- APIポーリング（最新→others） ---
  useEffect(() => {
    let prevLatest: string | null = null;

    const fetchData = () => {
      fetch(API_URL)
        .then((res) => res.json())
        .then((data) => {
          if (data?.files?.length) {
            const sorted = [...data.files].sort((a: string, b: string) => {
              const fa = a.split("/").pop() ?? "";
              const fb = b.split("/").pop() ?? "";
              return fa < fb ? 1 : -1;
            });

            const newLatest = sorted[0];

            if (prevLatest && prevLatest !== newLatest) {
              setLatest(newLatest);
              setOthers((prev) => [prevLatest!, ...prev]);
            } else if (!prevLatest) {
              setLatest(newLatest);
              setOthers(sorted.slice(1));
            }

            prevLatest = newLatest;
          }
        })
        .catch((err) => console.error("API fetch error:", err));
    };

    fetchData(); // 初回
    const id = setInterval(fetchData, 60_000); // 60秒ごと確認
    return () => clearInterval(id);
  }, []);

  // --- BGMミュート解除（10s後） ---
  useEffect(() => {
    const id = setTimeout(() => {
      const el = document.getElementById("bgm") as HTMLAudioElement | null;
      if (el) el.muted = false;
    }, 10_000);
    return () => clearTimeout(id);
  }, []);

  // --- 自動スクロール処理（従来のまま） ---
  useEffect(() => {
    if (!containerRef.current || !latest) return;
    const el = containerRef.current;
    el.scrollTop = el.scrollHeight; // 最下部から開始

    const duration = 10_000;
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

      // テロップ表示（0〜10000ms）
      if (elapsed >= 1000 && elapsed < 3000) {
        setMessage("Establishing link...");
      } else if (elapsed >= 3000 && elapsed < 5000) {
        setMessage("Receiving transmission...");
      } else if (elapsed >= 5000 && elapsed < 7000) {
        setMessage("Synchronizing mission time...");
      } else if (elapsed >= 7000 && elapsed < 10000) {
        setMessage("Connection established: Internet Voyager");
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
        setMessage(""); // 終了時は消す
      }
    }

    requestAnimationFrame(step);
  }, [latest]);

  // ==========================
  // ★ latest を確実に事前取得＆デコード（名前衝突対策済み）
  // ==========================
  const latestHref = latest ?? undefined;

  useEffect(() => {
    if (!latestHref) return;
    if (typeof window === "undefined") return; // SSRガード

    let cancelled = false;
    const img = new window.Image(); // ← グローバル Image を明示
    img.src = latestHref;

    const done = () => { if (!cancelled) { /* no-op */ } };

    // decode() があればデコード完了まで待つ
    const anyImg = img as HTMLImageElement & { decode?: () => Promise<void> };
    if (typeof anyImg.decode === "function") {
      anyImg.decode().then(done).catch(done);
    } else {
      img.onload = done;
      img.onerror = done;
    }
    return () => { cancelled = true; };
  }, [latestHref]);

  // --- ローディング ---
  if (!latest) {
    return (
      <main className="bg-black text-white h-screen flex items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="bg-black text-white min-h-screen flex justify-center relative">
      <Head>
        {/* 画像ホストに事前接続（必要に応じて調整） */}
        <link rel="dns-prefetch" href="https://storage.googleapis.com" />
        <link rel="preconnect" href="https://storage.googleapis.com" crossOrigin="" />
        {/* 最新画像をネットワーク層で先読み（高優先） */}
        {latestHref && (
          <link rel="preload" as="image" href={latestHref} fetchPriority="high" />
        )}
      </Head>

      {/* BGM */}
      <audio
        src="/background.mp3"
        autoPlay
        loop
        muted
        id="bgm"
        className="hidden"
      />

      <div ref={containerRef} className="w-full h-screen overflow-y-auto">
        {/* 最新スクショ（13,000ms以降に表示） */}
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

          {elapsedTime >= 13_000 && (
            <>
              <div className="absolute inset-0 bg-black/30 z-10" />
              <div className="relative z-20 w-full h-full flex items-center justify-center">
                <LatestScreenshotGrid
                  imageUrl={latest}
                  timestamp={extractTimestampRaw(latest) ?? new Date().toISOString()}
                />
              </div>
            </>
          )}
        </div>

        {/* 過去スクショ（next/image で最適化 & 低優先） */}
        <div className="grid grid-cols-4">
          {others.map((url) => (
            <div key={url} className="relative aspect-square bg-black">
              <NextImage
                src={url}
                alt="screenshot"
                fill
                sizes="25vw"
                className="object-cover object-top cursor-pointer"
                onClick={() => setSelectedImage(url)}
                loading="lazy"
                priority={false}
              />
              <span className="absolute bottom-1 right-1 text-[10px] sm:text-xs md:text-sm lg:text-base font-bold text-white leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">
                {extractTimestampPretty(url)}
              </span>
            </div>
          ))}
        </div>

        {/* 拡大表示モーダル（next/image） */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative w-[90vw] h-[90vh]">
              <NextImage
                src={selectedImage}
                alt="enlarged screenshot"
                fill
                sizes="90vw"
                className="object-contain rounded-lg shadow-lg"
                priority={false}
              />
            </div>
          </div>
        )}
      </div>

      {/* テロップ（0〜10000msのみ表示） */}
      {message && elapsedTime < 10_000 && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <span className="text-3xl font-bold text-white bg-black/70 px-6 py-3 animate-pulse">
            {message}
          </span>
        </div>
      )}
    </main>
  );
}
