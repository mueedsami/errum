/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Emergency switch: disables Next.js Image Optimization (/ _next/image),
    // which is commonly what racks up Vercel Image/Edge requests.
    unoptimized: true,
  },
};

module.exports = nextConfig;
