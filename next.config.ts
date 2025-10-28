import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 必要な外部ホストをここに列挙
    unoptimized: true,
    remotePatterns: [
      // Google Cloud Storage (例: https://storage.googleapis.com/<bucket>/path/to/file.jpg)
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        // バケットが決まっているなら、より厳密に
        // pathname: "/<your-bucket-name>/**",
      },
      // 例: Google Photos / Blogger 等（使っていれば）
      // { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // 他のCDNを使うならここに足す
      // { protocol: "https", hostname: "your-cdn.example.com" },
    ],
  },
};

export default nextConfig;
