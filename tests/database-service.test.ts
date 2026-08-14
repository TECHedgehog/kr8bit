import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { databaseRepository } from '../src/modules/database/database.repository.js';
import { scannerService } from '../src/modules/scanner/scanner.service.js';
import { databaseService } from '../src/modules/database/database.service.js';

vi.mock('../src/modules/database/database.repository.js', () => ({
  databaseRepository: {
    wipeAll: vi.fn(),
  },
}));

vi.mock('../src/modules/scanner/scanner.service.js', () => ({
  scannerService: {
    isRunning: vi.fn(),
  },
}));

describe('databaseService.reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wipes all tables when scanner not running', async () => {
    vi.mocked(scannerService.isRunning).mockReturnValue(false);
    vi.mocked(databaseRepository.wipeAll).mockResolvedValue({
      providerMatches: 1,
      games: 2,
      scanRuns: 3,
      steamApps: 4,
      settings: 5,
    });

    const result = await databaseService.reset();

    expect(result).toEqual({ providerMatches: 1, games: 2, scanRuns: 3, steamApps: 4, settings: 5 });
    expect(databaseRepository.wipeAll).toHaveBeenCalledTimes(1);
  });

  it('throws 409 when scanner is running', async () => {
    vi.mocked(scannerService.isRunning).mockReturnValue(true);

    await expect(databaseService.reset()).rejects.toThrow(AppError);
    await expect(databaseService.reset()).rejects.toMatchObject({
      statusCode: 409,
      code: 'SCAN_RUNNING',
    });
    expect(databaseRepository.wipeAll).not.toHaveBeenCalled();
  });
});
