import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

import { Types } from 'mongoose';

/**
 * Pipe to validate and transform MongoDB ObjectId strings
 * Throws BadRequestException if invalid
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, Types.ObjectId> {
  transform(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`Invalid ObjectId: ${value}`);
    }

    return new Types.ObjectId(value);
  }
}

/**
 * Pipe to validate ObjectId without throwing (returns null if invalid)
 */
@Injectable()
export class ParseObjectIdOptionalPipe implements PipeTransform<string, Types.ObjectId | null> {
  transform(value: string): Types.ObjectId | null {
    if (!value || !Types.ObjectId.isValid(value)) {
      return null;
    }

    return new Types.ObjectId(value);
  }
}

