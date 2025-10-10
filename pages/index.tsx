// pages/index.tsx
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import LatestScreenshotGrid from "../components/LatestScreenshotGrid";
import { useImagePreload } from "../hooks/useImagePreload";

export default function Home() {
  const [latest, setLatest] = useState<string | null>(null);
  const [others, setOthers] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // 自動スクロールの制御
  const hasStarted = useRef(false);         // 初回開始フラグ
  const [canRenderOthers, setCanRenderOthers] = useState(false); // others描画許可

  // テロップ & 経過時間
  const [message, setMessage] = useState("");
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

  // --- 経過時間カウント（latestが確定したら開始） ---
  useEffect(() => {
    if (!latest) return;
    const start = Date.now();
    const id = setInterval(() => setElapsedTime(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [latest]);

  // --- APIポーリング ---
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
              // 新着
              setLatest(newLatest);
              setOthers((prev) => [prevLatest!, ...prev]);
              // 新しい演出を最初からやりたい場合は以下で再演可能
              // hasStarted.current = false;
              // setCanRenderOthers(false);
            } else if (!prevLatest) {
              // 初回
              setLatest(newLatest);
              setOthers(sorted.slice(1));
            }
            prevLatest = newLatest;
          }
        })
        .catch((err) => console.error("API fetch error:", err));
    };

    fetchData();
    const id = setInterval(fetchData, 60_000);
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

  // --- 自動スクロール（最下部→上方向）。初回のみ開始。maxScrollを固定して安定化。 ---
  useEffect(() => {
    if (!containerRef.current || !latest) return;
    if (hasStarted.current) return;     // 初回だけ開始
    hasStarted.current = true;

    const el = containerRef.current;

    // scroll anchoring を無効化（Chrome等での“勝手な位置補正”を防ぐ）
    el.style.overflowAnchor = "none";

    // 開始時点の最大スクロール量を固定（DOMが伸びても影響させない）
    const maxScroll = el.scrollHeight - el.clientHeight;
    el.scrollTop = maxScroll; // 下端から開始

    const duration = 10_000;  // 10秒演出

    // 簡易イージング
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    let startTime: number | null = null;

    function step(now: number) {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;

      // テロップ
      if (elapsed >= 1000 && elapsed < 3000) setMessage("Establishing link...");
      else if (elapsed >= 3000 && elapsed < 5000) setMessage("Receiving transmission...");
      else if (elapsed >= 5000 && elapsed < 7000) setMessage("Synchronizing mission time...");
      else if (elapsed >= 7000 && elapsed < 10000) setMessage("Connection established: Internet Voyager");
      else setMessage("");

      const t = Math.min(1, elapsed / duration); // 0..1
      const s = easeOutCubic(t);
      el.scrollTop = Math.round(maxScroll * (1 - s)); // 下→上へ

      if (elapsed < duration) {
        requestAnimationFrame(step);
      } else {
        el.scrollTop = 0;
        setMessage("");
        setCanRenderOthers(true);      // ← 完了後に others を解禁
      }
    }

    requestAnimationFrame(step);
  }, [latest]);

  // --- 最新画像の先読み（ネットワーク＆JS両方） ---
  const latestReady = useImagePreload(latest ?? undefined);
  const latestHref = latest ?? undefined;

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
        {/* 先にコネクションを張る（画像ホストに合わせて調整） */}
        <link rel="dns-prefetch" href="https://storage.googleapis.com" />
        <link rel="preconnect" href="https://storage.googleapis.com" crossOrigin="" />
        {/* 最新画像はネットワーク層で最優先プリロード */}
        {latestHref && (
          <link rel="preload" as="image" href={latestHref} fetchPriority="high" />
        )}
      </Head>

      {/* JS側でも取得＆デコードを促進（保険） */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {latestHref && (
        <img
          src={latestHref}
          alt=""
          style={{ display: "none" }}
          fetchPriority="high"
          decoding="sync"
        />
      )}

      {/* BGM */}
      <audio
        src="/background.mp3"
        autoPlay
        loop
        muted
        id="bgm"
        className="hidden"
      />

      <div
        ref={containerRef}
        className="w-full h-screen overflow-y-auto"
        style={{ overflowAnchor: "none" }}   // 追加: anchoring無効化
      >
        {/* 最新スクショの演出画面 */}
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

          {/* 13,000ms以降に黒レイヤー + 最新スクショ */}
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

        {/* others はアニメ完了後に描画（高さが増えてもスクロール演出に影響させない） */}
        {canRenderOthers && (
          <div className="grid grid-cols-4">
            {others.map((url) => (
              <div key={url} className="relative aspect-square bg-black flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="screenshot"
                  className="w-full h-full object-cover object-top cursor-pointer"
                  onClick={() => setSelectedImage(url)}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                />
                <span className="absolute bottom-1 right-1 text-lg font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">
                  {extractTimestampPretty(url)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 拡大表示モーダル（低優先） */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]"
            onClick={() => setSelectedImage(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt="enlarged screenshot"
              className="max-w-5xl max-h-[90vh] object-contain rounded-lg shadow-lg"
              loading="eager"
              decoding="async"
              fetchPriority="low"
            />
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
