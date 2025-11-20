import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../guards/roles.guard';

/**
 * Marks a route as public (no authentication required)
 */
export const Public = () => SetMetadata('isPublic', true);

/**
 * Specifies required roles for a route
 */
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

/**
 * Applies throttling to a route
 */
export const Throttle = (limit: number, ttl: number) =>
  SetMetadata('throttle', { limit, ttl });

/**
 * Combines decorators for admin-only routes
 */
export const AdminOnly = () => Roles(UserRole.ADMIN);

/**
 * Combines decorators for organizer routes
 */
export const OrganizerOnly = () => Roles(UserRole.ORGANIZER, UserRole.ADMIN);

/**
 * Combines decorators for judge routes
 */
export const JudgeOnly = () =>
  Roles(UserRole.JUDGE, UserRole.ORGANIZER, UserRole.ADMIN);

