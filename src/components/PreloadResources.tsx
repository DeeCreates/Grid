// src/components/PreloadResources.tsx
import { useEffect } from 'react';

export function PreloadResources() {
  useEffect(() => {
    // Prefetch common routes on hover
    const prefetchRoutes = ['/services', '/solutions', '/contact'];
    
    prefetchRoutes.forEach(route => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = route;
      link.as = 'document';
      document.head.appendChild(link);
    });

    // Preload images for above-the-fold content
    const criticalImages = [
      '/hero-bg.jpg',
      '/logo.svg',
    ];

    criticalImages.forEach(image => {
      const img = new Image();
      img.src = image;
    });

    // Preload WebFont if using custom fonts
    if ('fonts' in document) {
      const font = new FontFace(
        'Inter',
        'url(/fonts/inter.woff2) format("woff2")',
        { weight: '400 700', display: 'swap' }
      );
      font.load().then(() => {
        document.fonts.add(font);
      });
    }
  }, []);

  return null;
}