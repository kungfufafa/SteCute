import { db, type Session, type Shot, type TemplateConfig } from '@/db/schema'
import type { CaptureSessionConfig } from './capture-config'

function assertEditableCameraSession(session: Session | undefined): asserts session is Session {
  if (
    !session ||
    session.captureSource !== 'camera' ||
    session.status !== 'idle' ||
    session.finalRenderId
  ) {
    throw new Error('Sesi kamera sudah tidak dapat diubah.')
  }
}

/** Session settings are editable only before the first source photo exists. */
export async function reconfigureCameraSession(
  sessionId: string,
  config: CaptureSessionConfig,
  template: TemplateConfig,
) {
  if (
    !config.layoutId ||
    !config.templateId ||
    template.id !== config.templateId ||
    !Number.isInteger(config.slotCount) ||
    config.slotCount < 1 ||
    ![3, 5, 10].includes(config.countdownSeconds)
  ) {
    throw new Error('Pengaturan sesi tidak valid.')
  }

  return db.transaction('rw', db.sessions, db.shots, async () => {
    const session = await db.sessions.get(sessionId)
    assertEditableCameraSession(session)
    if ((await db.shots.where('sessionId').equals(sessionId).count()) > 0) {
      throw new Error(
        'Pengaturan dikunci setelah foto pertama. Ulang semua foto untuk mengubahnya.',
      )
    }

    const nextSession = {
      ...session,
      layoutId: config.layoutId,
      templateId: config.templateId,
      slotCount: config.slotCount,
      decorationConfig: {
        ...session.decorationConfig,
        frameColor:
          session.templateId === config.templateId
            ? session.decorationConfig.frameColor
            : template.defaultFrameColor,
      },
    }
    await db.sessions.put(nextSession)
    return { session: nextSession, shots: [] as Shot[] }
  })
}

/** Explicit restart clears photos while retaining the camera session and its decoration assets. */
export async function restartCameraSessionPhotos(sessionId: string) {
  return db.transaction('rw', db.sessions, db.shots, async () => {
    const session = await db.sessions.get(sessionId)
    assertEditableCameraSession(session)
    await db.shots.where('sessionId').equals(sessionId).delete()
    return { session, shots: [] as Shot[] }
  })
}
