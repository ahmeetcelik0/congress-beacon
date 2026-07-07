import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PilotLoginDto } from './dto/pilot-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('pilot-login')
  pilotLogin(@Body() dto: PilotLoginDto) {
    return this.authService.pilotLogin(dto);
  }
}
