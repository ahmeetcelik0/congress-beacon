/// Yönlendirme kararının SAF mantığı - Flutter/go_router/Riverpod'dan
/// bağımsız, bu yüzden birim testiyle doğrudan doğrulanabilir (bkz.
/// `test/route_redirect_test.dart`). `app_router.dart` bu fonksiyonu
/// Riverpod durumlarından türetilen değerlerle çağırır.
///
/// Sıra (Faz 6 talimatı §5): izin → oturum → zorunlu şifre → kongre
/// seçimi → kabuk.
library;

const List<String> publicAuthRoutes = [
  '/login',
  '/register',
  '/forgot-password',
];

// '/change-password' ve '/select-congress' BILEREK burada YOK: ikisi de
// CIFT amaclidir - zorunlu giris kapisi (yukaridaki mustChangePassword/
// activeCongressId kontrolleriyle) OLABILECEGI GIBI, Profilim'den
// GONULLU olarak da ziyaret edilebilir ("Sifre Degistir", "Kongre
// Degistir"). Bu listeye eklenirlerse, zaten bir kongresi/gecerli sifresi
// olan bir kullanici gonullu ziyaretinde ANINDA /home'a geri firlatilirdi.
const List<String> entryOnlyRoutes = [
  '/splash',
  '/permission',
  ...publicAuthRoutes,
];

/// `null` dönerse yönlendirme YAPILMAZ (mevcut konumda kalınır).
String? computeRedirectPath({
  required String location,
  required bool permissionLoading,
  required bool permissionSufficient,
  required bool authLoading,
  required bool authHasError,
  required bool isAuthenticated,
  required bool mustChangePassword,
  required String? activeCongressId,
}) {
  // İzin durumu henüz çözülmediyse ilk açılışta splash'te kal.
  if (permissionLoading) {
    return location == '/splash' ? null : '/splash';
  }

  // İzin, OTURUM KONTROLÜNDEN (ve onun ağ hatası olasılığından) ÖNCE
  // değerlendirilir - sıra kesinlikle izin -> oturum'dur (Faz 6 talimatı
  // §5). Aksi halde, backend'e ulaşılamadığı için oturum kontrolü hata
  // verdiğinde (ör. ağ yokken), izin hiç verilmemiş olsa bile kullanıcı
  // yanlışlıkla splash'in "tekrar dene" ekranına düşer ve zorunlu izin
  // ekranı hiç gösterilmez. Bu tam olarak simulator doğrulamasında
  // yakalanan bir regresyondu - bkz. route_redirect_test.dart.
  if (!permissionSufficient) {
    return location == '/permission' ? null : '/permission';
  }

  // İzin yeterliyse, şimdi oturum durumu (yükleniyor/hata) değerlendirilir.
  if (authLoading || authHasError) {
    return location == '/splash' ? null : '/splash';
  }

  if (!isAuthenticated) {
    return publicAuthRoutes.contains(location) ? null : '/login';
  }

  if (mustChangePassword) {
    return location == '/change-password' ? null : '/change-password';
  }

  if (activeCongressId == null) {
    return location == '/select-congress' ? null : '/select-congress';
  }

  // Buraya kadar geldiyse her sart saglanmis demektir - giris/kayit/izin
  // gibi "giris noktasi" ekranlarinda oyalanmamali, kabuga gecmeli.
  if (entryOnlyRoutes.contains(location)) {
    return '/home';
  }

  return null;
}
