import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';

// uploads/multer-exception.filter.ts ile AYNI desen (Multer, boyut siniri
// asilinca kendi Ingilizce mesajiyla bir PayloadTooLargeException uretir -
// bu filtre yalnizca mesaji Turkcelestirir), farkli bir boyut siniri ve
// mesajla (program dosyalari 32 MB'a kadar - Claude'un PDF istek siniriyla
// AYNI, bkz. Faz 4b talimati).
@Catch(PayloadTooLargeException)
export class ProgramImportMulterExceptionFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: 'Dosya en fazla 32 MB olabilir',
      error: 'Payload Too Large',
    });
  }
}
