import { validateFilenameFormat, CUSTOM_FORMAT_SETTING, DEFAULT_FILENAME_FORMAT, FORMAT_TAGS } from './filename-format.js';

interface NamingSettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}

interface NamingServiceDependencies {
  settingsRepository: NamingSettingsRepository;
}

export function createNamingService({ settingsRepository }: NamingServiceDependencies) {
  async function namingSettings() {
    const customFormat = await settingsRepository.get(CUSTOM_FORMAT_SETTING);
    return {
      defaultFormat: DEFAULT_FILENAME_FORMAT,
      tags: [...FORMAT_TAGS],
      customFormat: customFormat?.trim() || null,
    };
  }

  return {
    namingSettings,

    async updateNamingFormat(format: string) {
      const trimmed = format.trim();
      const validatedFormat = trimmed ? validateFilenameFormat(trimmed) : '';
      await settingsRepository.set(CUSTOM_FORMAT_SETTING, validatedFormat);
      return namingSettings();
    },
  };
}
