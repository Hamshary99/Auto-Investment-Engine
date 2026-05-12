import { NextFunction, Request, Response } from "express";
import { ClassConstructor, plainToInstance } from "class-transformer";
import { validate as classValidate } from "class-validator";
import { ApiError } from "../utils/error.handler";

/**
 * Generic DTO validator. Wraps a class-validator-decorated class as express
 * middleware: req.body is transformed into a DTO instance, validated, and
 * (on success) replaces req.body so downstream handlers get a typed object.
 *
 *   whitelist: drop properties not on the DTO
 *   forbidNonWhitelisted: 400 if the client sends unexpected fields
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
