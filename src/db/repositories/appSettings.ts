import { db, type AppSetting } from '../schema'

export class AppSettingsRepository {
  async get<T = unknown>(key: string): Promise<T | null> {
    const record = await db.appSettings.get(key)
    return record ? (record.value as T) : null
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    await db.appSettings.put({
      key,
      value,
      updatedAt: Date.now(),
    })
  }

  async remove(key: string): Promise<void> {
    await db.appSettings.delete(key)
  }

  async getAll(): Promise<AppSetting[]> {
    return db.appSettings.toArray()
  }

  async clearAll(): Promise<void> {
    await db.appSettings.clear()
  }
}
