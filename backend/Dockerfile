# Faz 4d: build context'i backend/ DEGIL, REPO KOKU (bkz. docker-compose.prod.yml
# `context: .`) - kanonik program semasi (shared/congress-program.schema.json)
# backend'in DISINDA, tek kaynak olarak tutuluyor (bkz. docs/decisions.md
# "Faz 4d"), Docker build context'i backend/e sinirliyken bu dosyaya HICBIR
# asamada erisilemezdi. Bu yuzden tum COPY yollari `backend/` on ekiyle
# yazilir, ve `shared/` klasoru ayrica kopyalanir. WORKDIR BILEREK `/app`
# DEGIL `/app/backend` - `extraction-schema.ts` semayi `process.cwd()`in
# BIR USTUNDEKI `shared/` klasorunden okur (bkz. o dosyadaki yorum); bu,
# yerel gelistirmedeki gercek yapiyi (`backend/` ve `shared/` REPO KOKUNDE
# KARDES klasorler) BIREBIR yansitir - WORKDIR `/app` olsaydi `process.cwd()`
# ile `shared/`in konumu (bir onceki denemede oldugu gibi) ORTAMLAR ARASINDA
# TUTARSIZ olurdu.

# --- Derleme asamasi: kaynak kodu TypeScript'ten JavaScript'e derler ---
FROM node:22-alpine AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm install
COPY backend/. .
COPY shared /app/shared
RUN npx prisma generate
RUN npm run build

# --- Calisma asamasi: sadece calismak icin gereken dosyalar kopyalanir ---
FROM node:22-alpine AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production

COPY backend/package.json backend/package-lock.json ./
# --omit=dev KULLANILMIYOR: prisma CLI (migrate deploy icin gerekli) devDependencies'de.
RUN npm install

COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/generated ./generated
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/shared /app/shared

EXPOSE 3001

# Konteyner her baslarken once bekleyen migration'lari uygular, sonra uygulamayi baslatir.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
