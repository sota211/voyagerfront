import React, { useEffect, useMemo, useState } from "react";

type Props = {
  imageUrl: string;
  timestamp: string;
};

const GRID = 60; // 100x100
const TOTAL_CELLS = GRID * GRID;
const DURATION_MS = 60 * 60 * 1000; // 30分

const START_MISSION = new Date("2025-09-11T21:00:00Z").getTime(); // MET開始時間

function parseTimestamp(ts: string): Date {
  if (/^\d{8}_\d{6}$/.test(ts)) {
    const y = ts.slice(0, 4);
    const m = ts.slice(4, 6);
    const d = ts.slice(6, 8);
    const hh = ts.slice(9, 11);
    const mm = ts.slice(11, 13);
    const ss = ts.slice(13, 15);
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
  }
  return new Date(ts);
}

const LatestScreenshotGrid: React.FC<Props> = ({ imageUrl, timestamp }) => {
  const [visibleCells, setVisibleCells] = useState(0);
  const [elapsed, setElapsed] = useState("00:00:00:00");

  // 行優先（row → col）
  const indexToRowCol = (i: number) => {
    const row = Math.floor(i / GRID);
    const col = i % GRID;
    return { row, col };
  };

  // 初期セル数
  const initialVisible = useMemo(() => {
    const taken = parseTimestamp(timestamp).getTime();
    const now = Date.now();
    const elapsed = Math.max(0, now - taken);
    return Math.min(
      TOTAL_CELLS,
      Math.floor((elapsed / DURATION_MS) * TOTAL_CELLS)
    );
  }, [timestamp]);

  // エフェクト進行（滑らか）
  useEffect(() => {
    const taken = parseTimestamp(timestamp).getTime();

    const animate = () => {
      const elapsed = Math.max(0, Date.now() - taken);
      const cells = Math.min(
        TOTAL_CELLS,
        Math.floor((elapsed / DURATION_MS) * TOTAL_CELLS)
      );
      setVisibleCells(cells);
      requestAnimationFrame(animate);
    };

    setVisibleCells(initialVisible);
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [timestamp, initialVisible]);

  // MET更新（日数桁付き）
  useEffect(() => {
    const tick = () => {
      const diff = Date.now() - START_MISSION;
      const totalSec = Math.floor(diff / 1000);
      const dd = String(Math.floor(totalSec / 86400)).padStart(2, "0");
      const hh = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, "0");
      const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSec % 60).padStart(2, "0");
      setElapsed(`${dd}:${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-black/40 text-white">
      {/* 上部テキスト */}
      <div className="text-center mb-4">
        <div className="text-lg font-semibold tracking-wide">
          Mission Elapsed Time
        </div>
        <div className="text-2xl font-mono mb-4">{elapsed}</div>
        <div className="text-lg italic">Current transmission from Internet Voyager</div>
      </div>

      {/* 画像エフェクト */}
      <div
        className="relative"
        style={{
          width: "70vmin",
          height: "70vmin",
          display: "grid",
          gridTemplateColumns: `repeat(${GRID}, 1fr)`,
          gridTemplateRows: `repeat(${GRID}, 1fr)`,
          overflow: "hidden",
        }}
      >
        {Array.from({ length: visibleCells }).map((_, i) => {
          const { row, col } = indexToRowCol(i);
          const bgPosX = GRID > 1 ? (col / (GRID - 1)) * 100 : 0;
          const bgPosY = GRID > 1 ? (row / (GRID - 1)) * 100 : 0;

          return (
            <div
              key={i}
              style={{
                gridColumnStart: col + 1,
                gridRowStart: row + 1,
                backgroundImage: `url(${imageUrl})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${GRID * 100}% ${GRID * 100}%`,
                backgroundPosition: `${bgPosX}% ${bgPosY}%`,
              }}
            />
          );
        })}
      </div>

      {/* 下部テキスト */}
      <div className="text-center mt-6 space-y-2">
        <div className="text-lg">
          Scroll down to review past transmissions
        </div>
      </div>
    </div>
  );
};

export default LatestScreenshotGrid;
