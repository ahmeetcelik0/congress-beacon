import type { Request } from 'express';
import type { User } from '../../generated/prisma/client';

// JwtAuthGuard, dogrulanan JWT'nin activeCongressId alanini User nesnesine
// congressId olarak enjekte eder (bkz. jwt-auth.guard.ts) - boylece
// user.congressId okuyan mevcut kod, DB'deki User modelinden congressId
// kaldirilmis olsa bile (Faz 1) degismeden calisir. Deger, o istekteki
// TOKEN'in tasidigi aktif kongredir - DB'de kalici bir alan degildir.
export type AuthenticatedUser = User & { congressId: string | null };

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
