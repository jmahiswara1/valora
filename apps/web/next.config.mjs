const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIRECTORY ?? '.next',
  allowedDevOrigins: ['127.0.0.1'],
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: (process.env.API_INTERNAL_ORIGIN ?? 'http://127.0.0.1:4000') + '/api/v1/:path*' }];
  },
};

export default nextConfig;
