import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';

// FileInterceptor (multer), boyut siniri asilinca ham MulterError'i KENDI
// ICINDE zaten bir PayloadTooLargeException'a cevirir (bkz.
// @nestjs/platform-express multer.utils.ts transformException) - orijinal
// Ingilizce Multer mesaji ('File too large') bu exception'in mesaji olarak
// KORUNUR ve diger iki reddetme senaryosundan (magic-byte, kongre
// bulunamadi - ikisi de Turkce) farkli olarak kullaniciya Ingilizce
// gorunurdu. @Catch(MulterError) BURADA HIC ESLESMEZ, cunku bu noktada
// artik bir MulterError degil, zaten donusturulmus bir HttpException'dir -
// bu filtre onu yakalayip yalnizca mesaji Turkcelestirir.
@Catch(PayloadTooLargeException)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: 'Dosya en fazla 2 MB olabilir',
      error: 'Payload Too Large',
    });
  }
}
