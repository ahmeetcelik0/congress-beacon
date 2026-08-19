// Faz 3'te yuklenen gorseller GORELI yol olarak saklanir (`/uploads/...`,
// bkz. uploads.service.ts) - panel ayni origin'den servis edildigi icin bu
// sorun degildi. Mobil uygulama FARKLI bir origin'den (ayri bir host/port,
// ilerleyen surumlerde CDN) calisacagi icin (Faz 5 talimati) mobil
// yanitlarindaki her gorsel alani MUTLAK URL olmali. Bu donusum TEK bir
// yerde yapilir - her mobil endpoint'te elle tekrarlanmaz.
function getAppPublicUrl(): string {
  const configured = process.env.APP_PUBLIC_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  // Yerel gelistirmede APP_PUBLIC_URL genelde tanimli degildir - backend'in
  // kendi PORT'una gore makul bir varsayilan uretilir (bkz. main.ts'deki
  // ayni varsayilan).
  const port = process.env.PORT ?? '3001';
  return `http://localhost:${port}`;
}

// `null`/`undefined` oldugu gibi kalir (gorsel yoksa). Zaten mutlak olan
// (http:// / https:// ile baslayan - ör. ilerde S3/CDN'e gecilirse) bir
// deger DOKUNULMADAN doner, cift donusum onlenir.
export function toAbsoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getAppPublicUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
