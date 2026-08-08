import type { NextConfig } from "next";

// Yerel gelistirmede (Berke ve Ahmet icin) hicbir sey degismesin diye
// basePath yalnizca NEXT_BASE_PATH ortam degiskeni verildiginde devreye girer
// (production Docker imajinda /yetkili olarak ayarlanacak).
const nextConfig: NextConfig = {
  basePath: process.env.NEXT_BASE_PATH ?? "",
  output: "standalone",
  // Varsayilan Server Action govde siniri 1 MB'dir (bkz. Next.js
  // `serverActions.bodySizeLimit` dokumani) - hem katilimci Excel/CSV
  // yuklemesi (~5 MB) hem de bilimsel program PDF/Excel yuklemesi (backend
  // `MAX_FILE_SIZE_BYTES` = 32 MB, bkz. `program-imports.controller.ts`) bu
  // varsayilani asar. Backend siniriyla ayni ust sinira, multipart
  // boundary/alan basligi ek yukune (~10-20 KB) pay birakarak cikariyoruz.
  experimental: {
    serverActions: {
      bodySizeLimit: "35mb",
    },
  },
};

export default nextConfig;
