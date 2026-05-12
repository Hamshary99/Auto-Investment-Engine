import { NextFunction, Request, Response } from "express";
import { ClassConstructor, plainToInstance } from "class-transformer";
import { validate as classValidate } from "class-validator";
import { ApiError } from "../utils/error.handler";

/**
 * Generic DTO validator middleware. Transforms req.body into a class-validator
 * decorated DTO instance, validates, and replaces req.body on success.
 *
 *   whitelist:             drop unknown properties
 *   forbidNonWhitelisted:  reject unknown properties with 400
 */
export const validate = <T extends object>(DtoClass: ClassConstructor<T>) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const dto = plainToInstance(DtoClass, req.body);
    const errors = await classValidate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) {
      const details = errors.flatMap((e) =>
        Object.values(e.constraints ?? {}).map((message) => ({ path: e.property, message }))
      );
      return next(new ApiError("validation failed", 400, "validation_error", details));
    }
    req.body = dto;
    next();
  };
