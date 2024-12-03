/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverRuntimeConfig: {
    geminiApiKey: process.env.GEMINI_API_KEY,
  },
};

export default nextConfig;
