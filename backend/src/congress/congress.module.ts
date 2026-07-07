import { Module } from '@nestjs/common';
import { CongressController } from './congress.controller';
import { CongressService } from './congress.service';

@Module({
  controllers: [CongressController],
  providers: [CongressService],
  exports: [CongressService],
})
export class CongressModule {}
