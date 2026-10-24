// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';

// 모든 페이지는 서버(SSR)에서 완성된 HTML로 렌더링되고,
// 공개 페이지는 src/lib/cache.ts 가 붙이는 CDN 캐시 헤더로 Netlify 엣지에 캐시됩니다.
export default defineConfig({
  site: process.env.SITE_URL || process.env.URL || 'http://localhost:4321',
  output: 'server',
  adapter: netlify({
    // 캐시 헤더는 페이지마다 직접 지정하므로 어댑터의 일괄 캐시는 끕니다.
    cacheOnDemandPages: false,
    // 이미지는 브라우저에서 미리 WebP로 줄여 올리므로 Image CDN 변환은 쓰지 않습니다(크레딧 절약).
    imageCDN: false,
    devFeatures: { environmentVariables: false, images: false, edgeFunctions: false },
  }),
  trailingSlash: 'never',
  build: { format: 'file' },
  compressHTML: true,
  prefetch: false,
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
