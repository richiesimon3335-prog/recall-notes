import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Allow loading images from Supabase Storage
     * e.g. https://xxxx.supabase.co/storage/v1/object/...
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;