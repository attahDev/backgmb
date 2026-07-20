import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateNominationStatusDto {
  @IsIn(['APPROVED', 'REJECTED', 'PENDING'])
  @IsNotEmpty()
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
}
