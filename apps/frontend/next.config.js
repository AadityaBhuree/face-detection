/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // PWA is dev-friendly off (avoids stale SW caching during hot reload)
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    // Pages & navigations — NetworkFirst: fresh when online, cached offline
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin &&
        (url.pathname === '/' ||
          url.pathname.startsWith('/dashboard') ||
          url.pathname.startsWith('/intake')),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'jeevandata-pages',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Same-origin API GETs — NetworkFirst with a short timeout so fresh data wins
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin && url.pathname.startsWith('/api/'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'jeevandata-api',
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Static assets — stale-while-revalidate for speed
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin && url.pathname.startsWith('/_next/'),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'jeevandata-static',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
  ],
});

module.exports = withPWA(nextConfig);
