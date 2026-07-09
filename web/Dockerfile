# --- Derleme asamasi ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

# NEXT_PUBLIC_* degiskenleri derleme sirasinda tarayici koduna gomulur,
# bu yuzden calisma zamaninda degil, build-time ARG olarak verilmesi sart.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_BASE_PATH
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_BASE_PATH=$NEXT_BASE_PATH

RUN npm run build

# --- Calisma asamasi: Next.js'in "standalone" ciktisi, node_modules gerekmeden calisir ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Standalone sunucu varsayilan olarak konteynerin kendi ic IP'sine baglaniyor;
# 0.0.0.0 ile tum arayuzlerden erisilebilir hale getiriyoruz.
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
