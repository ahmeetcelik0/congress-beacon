import 'dart:convert';

import 'package:beacon/core/auth/jwt_expiry.dart';
import 'package:flutter_test/flutter_test.dart';

String _encodeSegment(Map<String, dynamic> json) {
  final bytes = utf8.encode(jsonEncode(json));
  // Gercek JWT'ler DOLGUSUZDUR - testin kendisi de dolguyu kaldirarak
  // `checkJwtExpiry`nin `base64Url.normalize` ile bunu dogru ele aldigini
  // kanitlar (bkz. fonksiyonun kendi yorumu).
  return base64Url.encode(bytes).replaceAll('=', '');
}

String _buildToken(Map<String, dynamic> payload) {
  final header = _encodeSegment({'alg': 'HS256', 'typ': 'JWT'});
  final body = _encodeSegment(payload);
  return '$header.$body.fakesignature';
}

void main() {
  group('checkJwtExpiry', () {
    test('gecerli (gelecekteki) exp -> valid', () {
      final exp = DateTime.now().toUtc().add(const Duration(hours: 1));
      final token = _buildToken({'exp': exp.millisecondsSinceEpoch ~/ 1000});
      expect(checkJwtExpiry(token), JwtStatus.valid);
    });

    test('gecmis exp -> expired', () {
      final exp = DateTime.now().toUtc().subtract(const Duration(hours: 1));
      final token = _buildToken({'exp': exp.millisecondsSinceEpoch ~/ 1000});
      expect(checkJwtExpiry(token), JwtStatus.expired);
    });

    test('bozuk token (3 parcali degil) -> undecodable', () {
      expect(checkJwtExpiry('sadece.ikiparca'), JwtStatus.undecodable);
      expect(checkJwtExpiry('tekparca'), JwtStatus.undecodable);
      expect(checkJwtExpiry(''), JwtStatus.undecodable);
    });

    test('dolgusuz (unpadded) payload dogru cozumlenir', () {
      // _buildToken zaten dolgusuz uretiyor (gercek JWT davranisi) - bu
      // test normalize() cagrisinin GERCEKTEN calistigini kanitlar.
      final exp = DateTime.now().toUtc().add(const Duration(minutes: 5));
      final token = _buildToken({'exp': exp.millisecondsSinceEpoch ~/ 1000});
      expect(token.contains('='), isFalse);
      expect(checkJwtExpiry(token), JwtStatus.valid);
    });

    test('exp alani olmayan token -> undecodable', () {
      final token = _buildToken({'sub': 'user-1'});
      expect(checkJwtExpiry(token), JwtStatus.undecodable);
    });

    test('exp yanlis turde (string) -> undecodable', () {
      final token = _buildToken({'exp': 'yakinda'});
      expect(checkJwtExpiry(token), JwtStatus.undecodable);
    });

    test('payload gecerli JSON degil -> undecodable', () {
      final token = 'aGVhZGVy.${base64Url.encode(utf8.encode('{bozuk'))}.imza';
      expect(checkJwtExpiry(token), JwtStatus.undecodable);
    });

    test(
      'saat kaymasi toleransi - exp az once gecti ama tolerans icinde -> valid',
      () {
        final exp = DateTime.now().toUtc().subtract(
          const Duration(seconds: 30),
        );
        final token = _buildToken({'exp': exp.millisecondsSinceEpoch ~/ 1000});
        expect(
          checkJwtExpiry(
            token,
            clockSkewTolerance: const Duration(seconds: 60),
          ),
          JwtStatus.valid,
        );
      },
    );

    test('tolerans disinda kalan gecmis exp -> expired', () {
      final exp = DateTime.now().toUtc().subtract(const Duration(seconds: 90));
      final token = _buildToken({'exp': exp.millisecondsSinceEpoch ~/ 1000});
      expect(
        checkJwtExpiry(token, clockSkewTolerance: const Duration(seconds: 60)),
        JwtStatus.expired,
      );
    });
  });

  group('extractJwtSubject', () {
    test('sub alani varsa doner', () {
      final token = _buildToken({'sub': 'user-123', 'exp': 0});
      expect(extractJwtSubject(token), 'user-123');
    });

    test('sub alani yoksa null doner', () {
      final token = _buildToken({'exp': 0});
      expect(extractJwtSubject(token), isNull);
    });

    test('bozuk token icin null doner', () {
      expect(extractJwtSubject('bozuk'), isNull);
    });
  });
}
