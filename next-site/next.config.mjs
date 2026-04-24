

const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isProd ? '/molearn' : '',
  assetPrefix: isProd ? '/molearn' : '',
}

export default nextConfig
