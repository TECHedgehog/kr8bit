import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../src/shared/errors.js';
import { createNamingService } from '../src/modules/library/naming.service.js';
import { CUSTOM_FORMAT_SETTING, DEFAULT_FILENAME_FORMAT, FORMAT_TAGS } from '../src/modules/library/filename-format.js';

function setup(savedFormat: string | null = null) {
  let storedFormat = savedFormat;
  const settingsRepository = {
    get: vi.fn(async (key: string) => key === CUSTOM_FORMAT_SETTING ? storedFormat : null),
    set: vi.fn(async (key: string, value: string) => {
      if (key === CUSTOM_FORMAT_SETTING) storedFormat = value;
    }),
  };
  return { service: createNamingService({ settingsRepository }), settingsRepository };
}

describe('naming service', () => {
  it('reads default format and supported tags', async () => {
    const { service } = setup();

    await expect(service.namingSettings()).resolves.toEqual({
      defaultFormat: DEFAULT_FILENAME_FORMAT,
      tags: [...FORMAT_TAGS],
      customFormat: null,
    });
  });

  it('reads custom format', async () => {
    const { service } = setup(' {title} ');

    await expect(service.namingSettings()).resolves.toMatchObject({ customFormat: '{title}' });
  });

  it('saves trimmed custom format and echoes settings', async () => {
    const { service, settingsRepository } = setup();

    await expect(service.updateNamingFormat(' {title} ')).resolves.toMatchObject({ customFormat: '{title}' });
    expect(settingsRepository.set).toHaveBeenCalledWith(CUSTOM_FORMAT_SETTING, '{title}');
  });

  it('clears custom format when input is empty', async () => {
    const { service, settingsRepository } = setup('{title}');

    await expect(service.updateNamingFormat('   ')).resolves.toMatchObject({ customFormat: null });
    expect(settingsRepository.set).toHaveBeenCalledWith(CUSTOM_FORMAT_SETTING, '');
  });

  it('rejects invalid format without persisting it', async () => {
    const { service, settingsRepository } = setup();

    await expect(service.updateNamingFormat('{unknown}')).rejects.toThrow(ValidationError);
    expect(settingsRepository.set).not.toHaveBeenCalled();
  });
});
