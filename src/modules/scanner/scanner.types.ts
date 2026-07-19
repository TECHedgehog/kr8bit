import type { ScanStatus } from '../../shared/enums.js';

export interface ScanRun {
  id: string;
  rootPath: string;
  startedAt: Date;
  finishedAt: Date | null;
  found: number;
  added: number;
  updated: number;
  failed: number;
  status: ScanStatus;
  errors: string[];
}

export interface ScanRunCreateInput {
  rootPath: string;
}

export interface ScanRunUpdateInput {
  finishedAt?: Date | null;
  found?: number;
  added?: number;
  updated?: number;
  failed?: number;
  status?: ScanStatus;
  errors?: string[];
}