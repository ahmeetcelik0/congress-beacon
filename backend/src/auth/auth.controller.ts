import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { PilotLoginDto } from './dto/pilot-login.dto';
import { EmailOrPhoneDto } from './dto/email-or-phone.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SelectCongressDto } from './dto/select-congress.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ThrottleByTargetGuard } from './throttle-by-target.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './authenticated-request';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('pilot-login')
  pilotLogin(@Body() dto: PilotLoginDto) {
    return this.authService.pilotLogin(dto);
  }

  // IP+hedef basina dakikada 1, saatte 5 (ThrottlerModule.forRoot'taki
  // 'perMinute'/'perHour' varsayilanlari - burada override edilmiyor).
  @Post('register-request')
  @UseGuards(ThrottleByTargetGuard)
  registerRequest(@Body() dto: EmailOrPhoneDto) {
    return this.authService.registerRequest(dto);
  }

  // Ayni kod-gonderim akisi (register-request ile), ayni limitler.
  @Post('forgot-password')
  @UseGuards(ThrottleByTargetGuard)
  forgotPassword(@Body() dto: EmailOrPhoneDto) {
    return this.authService.forgotPassword(dto);
  }

  // IP basina dakikada 10 - hedef bazli degil (dogru sifreyi bilen bir
  // saldirgan zaten hesaba ozel bir sinirla yavaslatilmaz, IP limiti
  // yeterli). Saatlik ('perHour') izleyici bu route icin atlanir.
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ perMinute: { limit: 10, ttl: 60_000 } })
  @SkipThrottle({ perHour: true })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user, dto);
  }

  @Get('my-congresses')
  @UseGuards(JwtAuthGuard)
  async myCongresses(@CurrentUser() user: AuthenticatedUser) {
    return { congresses: await this.authService.getCongressesForUser(user.id) };
  }

  @Post('select-congress')
  @UseGuards(JwtAuthGuard)
  selectCongress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SelectCongressDto,
  ) {
    return this.authService.selectCongress(user, dto.congressId);
  }
}
