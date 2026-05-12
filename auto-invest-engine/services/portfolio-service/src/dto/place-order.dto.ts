import { IsIn, IsNumber, IsPositive, IsString, Length } from "class-validator";

export class PlaceOrderDto {
  @IsString()
  @Length(1, 16)
  symbol!: string;

  @IsIn(["BUY", "SELL"])
  side!: "BUY" | "SELL";

  @IsNumber()
  @IsPositive()
  quantity!: number;
}
