/**
 * Module Interface - Standardized module structure for better organization
 * HIGH PRIORITY: Architecture improvements for maintainability
 */

import { DynamicModule, Type } from '@nestjs/common';

export interface ModuleMetadata {
  name: string;
  version: string;
  description: string;
  dependencies?: string[];
}

export interface ModuleConfig {
  enabled: boolean;
  options?: Record<string, any>;
}

export interface IBaseModule {
  /**
   * Get module metadata
   */
  getMetadata(): ModuleMetadata;

  /**
   * Initialize module
   */
  initialize?(): Promise<void>;

  /**
   * Cleanup module resources
   */
  cleanup?(): Promise<void>;

  /**
   * Health check
   */
  healthCheck?(): Promise<boolean>;
}

export interface IDynamicModuleFactory {
  /**
   * Register module asynchronously
   */
  registerAsync(options: ModuleAsyncOptions): DynamicModule;

  /**
   * Register module with options
   */
  register(options: ModuleConfig): DynamicModule;
}

export interface ModuleAsyncOptions {
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<ModuleConfig> | ModuleConfig;
  inject?: any[];
  useClass?: Type<ModuleOptionsFactory>;
  useExisting?: Type<ModuleOptionsFactory>;
}

export interface ModuleOptionsFactory {
  createModuleOptions(): Promise<ModuleConfig> | ModuleConfig;
}

export const MODULE_OPTIONS = Symbol('MODULE_OPTIONS');
export const MODULE_METADATA = Symbol('MODULE_METADATA');

export default {
  IBaseModule,
  IDynamicModuleFactory,
  MODULE_OPTIONS,
  MODULE_METADATA,
};

