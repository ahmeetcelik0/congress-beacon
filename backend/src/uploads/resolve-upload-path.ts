import { join, sep } from 'node:path';

// Yol gecisi (path traversal) korumasi: cozumlenen mutlak yol, verilen
// uploadsRoot'un DISINA TASMAMALI (ornegin url =
// '/uploads/../../etc/passwd' gibi bir deneme). Saf fonksiyon - disk I/O
// yapmaz, testte gercek dosya sistemine dokunmadan dogrulanabilir.
export function resolveUploadPath(
  url: string,
  uploadsRoot: string,
): string | null {
  if (!url.startsWith('/uploads/')) return null;

  const relative = url.slice('/uploads/'.length);
  const resolved = join(uploadsRoot, relative);

  if (resolved !== uploadsRoot && !resolved.startsWith(uploadsRoot + sep)) {
    return null;
  }
  return resolved;
}
