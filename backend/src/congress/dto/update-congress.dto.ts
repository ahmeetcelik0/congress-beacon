import { PartialType } from '@nestjs/mapped-types';
import { CreateCongressDto } from './create-congress.dto';

export class UpdateCongressDto extends PartialType(CreateCongressDto) {}
