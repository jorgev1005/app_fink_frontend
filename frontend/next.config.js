/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  env: {
    API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://75.119.154.6:4002',
  },
  async rewrites() {
    return [
      {
        source: '/backend-api/:path*',
        destination: process.env.NODE_ENV === 'development' 
          ? 'http://127.0.0.1:4002/:path*' 
          : 'http://75.119.154.6:4002/:path*',
      },
    ]
  },
}

module.exports = nextConfig
