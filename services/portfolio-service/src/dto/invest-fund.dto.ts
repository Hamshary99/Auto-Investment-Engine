import { IsNumber, IsPositive } from "class-validator";

export class InvestFundDto {
    @IsNumber()
    @IsPositive()
    amount!: number;
}
