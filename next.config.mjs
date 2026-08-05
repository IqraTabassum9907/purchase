/** @type {import('next').NextConfig} */
const nextConfig = {
  // Move the dev-mode indicator badge away from the bottom-left corner so it
  // doesn't sit on top of the sidebar's "Logged in as / Logout" section.
  devIndicators: {
    position: 'bottom-right',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URI: process.env.NEXT_PUBLIC_API_URI || '/api/sheets',
  },
}

export default nextConfig
