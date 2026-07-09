import type { NextConfig } from "next";

// Yerel gelistirmede (Berke ve Ahmet icin) hicbir sey degismesin diye
// basePath yalnizca NEXT_BASE_PATH ortam degiskeni verildiginde devreye girer
// (production Docker imajinda /yetkili olarak ayarlanacak).
const nextConfig: NextConfig = {
  basePath: process.env.NEXT_BASE_PATH ?? "",
  output: "standalone",
};

export default nextConfig;
