import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_TITLE = "시사 문해력 기르기 학습지";
const SITE_DESCRIPTION = "이번 주 뉴스로 어휘력과 문해력을 기르는 학습지";

export const metadata: Metadata = {
  metadataBase: new URL("https://readingpractice.vercel.app"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  // 링크 공유 미리보기 (이미지는 app/opengraph-image.png)
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_TITLE,
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
