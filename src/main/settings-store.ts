import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sanitizeSettings } from '../shared/settings-schema.js';
import type { AppSettings } from '../shared/types.js';

export { sanitizeSettings };

/** JSON-file backed settings. Small enough that a dependency would cost more than it saves. */
export class SettingsStore {
  private readonly file: string;
  private cache: AppSettings;

  constructor(file = join(app.getPath('userData'), 'settings.json')) {
    this.file = file;
    this.cache = this.read();
  }

  get path(): string {
    return this.file;
  }

  get(): AppSettings {
    return { ...this.cache };
  }

  update(patch: Partial<AppSettings>): AppSettings {
    this.cache = sanitizeSettings({ ...this.cache, ...patch }, process.platform);
    this.write();
    return this.get();
  }

  reset(): AppSettings {
    this.cache = sanitizeSettings(undefined, process.platform);
    this.write();
    return this.get();
  }

  private read(): AppSettings {
    try {
      if (!existsSync(this.file)) return sanitizeSettings(undefined, process.platform);
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<AppSettings>;
      return sanitizeSettings(parsed, process.platform);
    } catch (error) {
      console.warn('[settings] falling back to defaults:', error);
      return sanitizeSettings(undefined, process.platform);
    }
  }

  /** Write via a temp file + rename so a crash mid-write cannot corrupt the settings. */
  private write(): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const temp = `${this.file}.tmp`;
      writeFileSync(temp, `${JSON.stringify(this.cache, null, 2)}\n`, 'utf8');
      renameSync(temp, this.file);
    } catch (error) {
      console.error('[settings] could not persist settings:', error);
    }
  }
}
