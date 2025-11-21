import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract current user from request
 * Assumes JWT guard has already authenticated and attached user to request
 *
 * @example
 * async createPost(@CurrentUser() user: User) {
 *   // user is automatically extracted from request
 * }
 */
export const CurrentUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;

  // If specific property requested, return just that property
  return data ? user?.[data] : user;
});

/**
 * Decorator to extract user ID from request
 */
export const CurrentUserId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user?.id || request.user?._id;
});

/**
 * Decorator to extract wallet address from request
 */
export const CurrentWallet = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user?.walletAddress;
});
