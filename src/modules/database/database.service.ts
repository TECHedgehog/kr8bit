import { databaseRepository } from './database.repository.js';
import { scannerService } from '../scanner/scanner.service.js';
import { AppError } from '../../shared/errors.js';
export const databaseService = {
  async reset() {
    if (scannerService.isRunning()) {
      throw new AppError(409, 'scan already running', 'SCAN_RUNNING');
    }
    return databaseRepository.wipeAll();
  },
};
