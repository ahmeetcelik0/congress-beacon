# Congress Beacon — Backend

NestJS + Prisma + MySQL API. Kimlik, kongre/salon/beacon/bilimsel program
yönetimi, salon tespit algoritması, push bildirimleri, e-posta.

Kurulum ve mimari için kök dizindeki [`README.md`](../README.md) ve
[`docs/`](../docs/) klasörüne bakın.

```bash
npm install
npx prisma generate && npx prisma migrate deploy
npm run start:dev   # http://localhost:3001
npm test
```
