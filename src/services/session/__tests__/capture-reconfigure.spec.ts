import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session, TemplateConfig } from '@/db/schema'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  getSession: vi.fn(),
  putSession: vi.fn(),
  shotWhere: vi.fn(),
  shotEquals: vi.fn(),
  deleteShots: vi.fn(),
  countShots: vi.fn(),
}))

vi.mock('@/db/schema', () => ({
  db: {
    transaction: mocks.transaction,
    sessions: { get: mocks.getSession, put: mocks.putSession },
    shots: { where: mocks.shotWhere },
  },
}))

import { db } from '@/db/schema'
import {
  reconfigureCameraSession,
  restartCameraSessionPhotos,
} from '@/services/session/capture-reconfigure'
import type { CaptureSessionConfig } from '@/services/session/capture-config'

const config: CaptureSessionConfig = {
  layoutId: 'strip-3-vertical',
  templateId: 'classic',
  slotCount: 3,
  countdownSeconds: 3,
  autoCapture: false,
}
const template = { id: 'classic', defaultFrameColor: '#ffffff' } as TemplateConfig
let session: Session

beforeEach(() => {
  vi.resetAllMocks()
  session = {
    id: 'session-1',
    status: 'idle',
    captureSource: 'camera',
    layoutId: config.layoutId,
    templateId: config.templateId,
    slotCount: config.slotCount,
    decorationConfig: {
      filterId: 'warm',
      cameraEffectId: 'none',
      virtualBackgroundId: 'custom',
      virtualBackgroundAssetId: 'background-1',
      frameColor: '#eeddff',
      selectedStickerIds: [],
      showDateTime: true,
      logoText: 'My photo',
    },
    startedAt: 100,
    completedAt: null,
    finalRenderId: null,
  }
  mocks.transaction.mockImplementation((...args: unknown[]) =>
    (args.at(-1) as () => Promise<unknown>)(),
  )
  mocks.getSession.mockResolvedValue(session)
  mocks.shotWhere.mockReturnValue({ equals: mocks.shotEquals })
  mocks.shotEquals.mockReturnValue({ delete: mocks.deleteShots, count: mocks.countShots })
  mocks.countShots.mockResolvedValue(0)
})

describe('camera configuration lock and explicit restart', () => {
  it('updates settings only before capture and preserves custom background metadata', async () => {
    const nextTemplate = { id: 'youth', defaultFrameColor: '#ffccdd' } as TemplateConfig
    const result = await reconfigureCameraSession(
      session.id,
      { ...config, templateId: 'youth', countdownSeconds: 10, autoCapture: true },
      nextTemplate,
    )
    expect(mocks.transaction).toHaveBeenCalledWith(
      'rw',
      db.sessions,
      db.shots,
      expect.any(Function),
    )
    expect(mocks.countShots).toHaveBeenCalledOnce()
    expect(mocks.deleteShots).not.toHaveBeenCalled()
    expect(result.shots).toEqual([])
    expect(result.session.id).toBe(session.id)
    expect(result.session.decorationConfig).toEqual({
      ...session.decorationConfig,
      frameColor: '#ffccdd',
    })
  })

  it('rejects every setting change when the database already contains a photo', async () => {
    mocks.countShots.mockResolvedValue(1)
    const configs = [
      { ...config, templateId: 'youth' },
      { ...config, layoutId: 'strip-4-vertical', slotCount: 4 },
      { ...config, countdownSeconds: 10 },
      { ...config, autoCapture: true },
    ]
    for (const next of configs) {
      await expect(
        reconfigureCameraSession(session.id, next, { ...template, id: next.templateId }),
      ).rejects.toThrow('dikunci setelah foto pertama')
    }
    expect(mocks.putSession).not.toHaveBeenCalled()
    expect(mocks.deleteShots).not.toHaveBeenCalled()
  })

  it('explicitly restarts only this session’s photos while retaining config and decoration assets', async () => {
    const result = await restartCameraSessionPhotos(session.id)
    expect(mocks.transaction).toHaveBeenCalledWith(
      'rw',
      db.sessions,
      db.shots,
      expect.any(Function),
    )
    expect(mocks.shotWhere).toHaveBeenCalledWith('sessionId')
    expect(mocks.shotEquals).toHaveBeenCalledWith(session.id)
    expect(mocks.deleteShots).toHaveBeenCalledOnce()
    expect(mocks.putSession).not.toHaveBeenCalled()
    expect(result.session).toBe(session)
    expect(result.shots).toEqual([])
  })

  it('rejects completed sessions before either editing settings or restarting photos', async () => {
    mocks.getSession.mockResolvedValue({ ...session, status: 'completed', finalRenderId: 'render' })
    await expect(reconfigureCameraSession(session.id, config, template)).rejects.toThrow(
      'tidak dapat diubah',
    )
    await expect(restartCameraSessionPhotos(session.id)).rejects.toThrow('tidak dapat diubah')
    expect(mocks.putSession).not.toHaveBeenCalled()
    expect(mocks.deleteShots).not.toHaveBeenCalled()
  })

  it('rejects invalid timer and mismatched frame without entering the transaction', async () => {
    await expect(
      reconfigureCameraSession(session.id, { ...config, countdownSeconds: 1 }, template),
    ).rejects.toThrow('tidak valid')
    await expect(
      reconfigureCameraSession(session.id, { ...config, templateId: 'missing' }, template),
    ).rejects.toThrow('tidak valid')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('lets photo deletion errors reject the restart transaction without returning an empty session', async () => {
    const failure = new Error('Photo deletion failed')
    mocks.deleteShots.mockRejectedValue(failure)
    await expect(restartCameraSessionPhotos(session.id)).rejects.toBe(failure)
    expect(mocks.putSession).not.toHaveBeenCalled()
  })
})
