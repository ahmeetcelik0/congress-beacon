const COOKIE_NAME = 'admin_token';

// Panel dahili/pilot amacli kullanildigi ve client-side fetch'ler backend'e
// (farkli origin, farkli port) dogrudan istek attigi icin token httpOnly
// DEGIL - boylece hem sunucu (SSR) hem tarayici tarafinda okunup Authorization
// header'ina eklenebiliyor. Panel gelecekte daha genis kullanima acilirsa
// bu, sunucu tarafinda proxy route + httpOnly cookie deseniyle sikilastirilmali.
export async function getAdminToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    const { cookies } = await import('next/headers');
    const store = await cookies();
    return store.get(COOKIE_NAME)?.value ?? null;
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export { COOKIE_NAME as ADMIN_TOKEN_COOKIE_NAME };
