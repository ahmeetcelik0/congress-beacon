# --- Derleme asamasi: kaynak kodu TypeScript'ten JavaScript'e derler ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Calisma asamasi: sadece calismak icin gereken dosyalar kopyalanir ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# --omit=dev KULLANILMIYOR: prisma CLI (migrate deploy icin gerekli) devDependencies'de.
RUN npm install

COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3001

# Konteyner her baslarken once bekleyen migration'lari uygular, sonra uygulamayi baslatir.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
