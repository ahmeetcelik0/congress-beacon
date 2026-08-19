# Congress Beacon — Mobil Uygulama

Flutter (iOS). Katılımcı kimliği, bilimsel program, beacon gözlemi, push
bildirimleri.

Kurulum ve mimari için kök dizindeki [`README.md`](../README.md) ve
[`docs/`](../docs/) klasörüne bakın.

```bash
flutter pub get
flutter run -d <cihaz-id> --dart-define=API_BASE_URL=http://<bilgisayar-ip>:3001
flutter analyze && flutter test
```

**Not:** `BeaconObservationService`'in ranging/duty-cycle/kuyruk mantığı
saha testlerinde defalarca kırılganlığı kanıtlanmış bir yüzeydir — bkz.
`docs/MIMARI.md` "Mobil beacon akışı — kritik kural".
