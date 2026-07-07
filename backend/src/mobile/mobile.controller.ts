import { Controller, Get, Query } from '@nestjs/common';
import { MobileService } from './mobile.service';
import { GetBootstrapQueryDto } from './dto/get-bootstrap-query.dto';

@Controller('mobile')
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Get('bootstrap')
  getBootstrap(@Query() query: GetBootstrapQueryDto) {
    return this.mobileService.getBootstrap(query.congressId);
  }
}
