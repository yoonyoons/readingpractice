import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 공모전 체험판(HTML 파일)이 다른 출처(file:// 등)에서 부르는 공개 API
  async headers() {
    return [
      {
        source: "/api/contest/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
