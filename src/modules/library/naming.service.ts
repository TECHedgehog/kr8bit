import { validateFilenameFormat, CUSTOM_FORMAT_SETTING_SPEC, DEFAULT_FILENAME_FORMAT, FORMAT_TAGS } from './filename-format.js';
import { createSettingsReader } from '../settings/settings.reader.js';

interface NamingSettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}

interface NamingServiceDependencies {
  settingsRepository: NamingSettingsRepository;
}

export function createNamingService({ settingsRepository }: NamingServiceDependencies) {
  const settingsReader = createSettingsReader(settingsRepository);

  async function namingSettings() {
    const customFormat = await settingsReader.string(CUSTOM_FORMAT_SETTING_SPEC);
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
      await settingsReader.write(CUSTOM_FORMAT_SETTING_SPEC, validatedFormat);
      return namingSettings();
    },
  };
}
