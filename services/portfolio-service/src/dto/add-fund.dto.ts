import { IsNumber, IsPositive } from "class-validator";

export class AddFundDto {
  @IsNumber()
  @IsPositive()
  amount!: number;
}
