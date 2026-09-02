/** @type {import('next').NextConfig} */
const nextConfig = {

  images: {
    unoptimized: true,
  },
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_API_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://tris-backend.fastapicloud.dev'
        : 'http://127.0.0.1:8000');
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;