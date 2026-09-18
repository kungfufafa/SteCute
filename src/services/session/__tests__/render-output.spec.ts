import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LayoutConfig, Shot, TemplateConfig } from '@/db/schema'

const mocks = vi.hoisted(() => ({
  getShots: vi.fn(),
  createRender: vi.fn(),
  deleteRender: vi.fn(),
  deleteShots: vi.fn(),
  deleteAssets: vi.fn(),
  updateDecoration: vi.fn(),
  setFinalRender: vi.fn(),
  updateStatus: vi.fn(),
  deleteOldRenders: vi.fn(),
  putSession: vi.fn(),
  renderStrip: vi.fn(),
  renderLiveStrip: vi.fn(),
}))

vi.mock('@/db/schema', () => ({
  db: {
    transaction: (...args: unknown[]) => (args.at(-1) as () => Promise<unknown>)(),
    sessions: { bulkDelete: vi.fn(), put: mocks.putSession },
  },
}))
vi.mock('@/db/repositories', () => ({
  SessionRepository: class {
    updateDecorationConfig = mocks.updateDecoration
    setFinalRender = mocks.setFinalRender
    updateStatus = mocks.updateStatus
  },
  ShotRepository: class {
    getBySession = mocks.getShots
    deleteBySession = mocks.deleteShots
  },
  RenderRepository: class {
    create = mocks.createRender
    delete = mocks.deleteRender
    deleteOldRenders = mocks.deleteOldRenders
  },
  AssetRepository: class {
    deleteBySessionId = mocks.deleteAssets
  },
}))
vi.mock('@/services/render', () => ({ renderStrip: mocks.renderStrip }))
vi.mock('@/services/live-cam', () => ({ renderLiveStrip: mocks.renderLiveStrip }))

import { createDefaultDecorationConfig, renderSessionForOutput } from '@/services/session'

const photo = new Blob(['photo'], { type: 'image/png' })
const video = new Blob(['video'], { type: 'video/webm' })
const params = {
  sessionId: 'session-1',
  layout: { id: 'strip-2-vertical', slotCount: 2 } as LayoutConfig,
  template: { id: 'classic' } as TemplateConfig,
  decoration: createDefaultDecorationConfig(),
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getShots.mockResolvedValue([{ order: 0 }, { order: 1 }])
  mocks.renderStrip.mockResolvedValue({ blob: photo, width: 1200, height: 1910 })
  mocks.renderLiveStrip.mockResolvedValue(null)
  mocks.createRender.mockResolvedValue('saved-render')
  mocks.deleteOldRenders.mockResolvedValue([])
})

describe('render output independently from storage', () => {
  it('renders in-memory Duet shots without requiring a database write first', async () => {
    const shots = [0, 1].map((order) => ({
      order,
      sourceType: 'booth',
      createdAt: 100 + order,
    })) as Shot[]
    mocks.renderStrip.mockImplementation(async () => {
      expect(mocks.putSession).not.toHaveBeenCalled()
      expect(mocks.createRender).not.toHaveBeenCalled()
      return { blob: photo, width: 1200, height: 1910 }
    })

    const output = await renderSessionForOutput({ ...params, shots })
    expect(output.persisted).toBe(true)
    expect(mocks.getShots).not.toHaveBeenCalled()
    expect(mocks.renderStrip).toHaveBeenCalledWith(expect.objectContaining({ shots }))
    expect(mocks.putSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: params.sessionId,
        captureSource: 'booth',
        status: 'completed',
        finalRenderId: 'saved-render',
        startedAt: 100,
      }),
    )
  })

  it('keeps the downloadable PNG and source shots when persistence is full', async () => {
    mocks.createRender.mockRejectedValue(new DOMException('Storage full', 'QuotaExceededError'))
    const output = await renderSessionForOutput(params)

    expect(output.persisted).toBe(false)
    expect(output.render.blob).toBe(photo)
    expect(output.render.id).toMatch(/^memory-/)
    expect(output.storageWarning).toContain('belum tersimpan di galeri')
    expect(mocks.updateDecoration).not.toHaveBeenCalled()
    expect(mocks.deleteShots).not.toHaveBeenCalled()
    expect(mocks.deleteAssets).not.toHaveBeenCalled()
  })

  it('falls back to saving PNG if storage cannot fit the optional video', async () => {
    mocks.getShots.mockResolvedValue([{ order: 0, liveClipBlob: video }, { order: 1 }])
    mocks.renderLiveStrip.mockResolvedValue({ blob: video, mimeType: 'video/webm' })
    mocks.createRender
      .mockRejectedValueOnce(new DOMException('Storage full', 'QuotaExceededError'))
      .mockResolvedValueOnce('photo-only')

    const output = await renderSessionForOutput(params)
    expect(output.persisted).toBe(true)
    expect(output.render.id).toBe('photo-only')
    expect(output.render.blob).toBe(photo)
    expect(output.render.liveBlob).toBeUndefined()
    expect(mocks.createRender.mock.calls[1][0].liveBlob).toBeUndefined()
    expect(mocks.deleteShots).toHaveBeenCalledWith(params.sessionId)
  })

  it('keeps both memory artifacts if even the PNG-only storage retry fails', async () => {
    mocks.getShots.mockResolvedValue([{ order: 0, liveClipBlob: video }, { order: 1 }])
    mocks.renderLiveStrip.mockResolvedValue({ blob: video, mimeType: 'video/webm' })
    mocks.createRender.mockRejectedValue(new DOMException('Storage full', 'QuotaExceededError'))

    const output = await renderSessionForOutput(params)
    expect(output.persisted).toBe(false)
    expect(output.render.blob).toBe(photo)
    expect(output.render.liveBlob).toBe(video)
    expect(mocks.deleteShots).not.toHaveBeenCalled()
  })

  it('does not report a saved render as lost when session finalization fails', async () => {
    mocks.updateDecoration.mockRejectedValue(new Error('Database unavailable'))
    const output = await renderSessionForOutput(params)
    expect(output.persisted).toBe(true)
    expect(output.render.id).toBe('saved-render')
    expect(output.render.blob).toBe(photo)
    expect(output.storageWarning).toContain('pembersihan')
  })

  it('shares an in-flight render when the same session is opened again', async () => {
    let finish!: (result: unknown) => void
    mocks.renderStrip.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const first = renderSessionForOutput(params)
    const second = renderSessionForOutput(params)
    expect(first).toBe(second)
    finish({ blob: photo, width: 1200, height: 1910 })
    await Promise.all([first, second])
    expect(mocks.renderStrip).toHaveBeenCalledTimes(1)
    expect(mocks.createRender).toHaveBeenCalledTimes(1)
  })

  it('does not reuse or persist an aborted render after its session is edited', async () => {
    const controller = new AbortController()
    let finishOld!: (result: unknown) => void
    const editedPhoto = new Blob(['edited photo'], { type: 'image/png' })
    mocks.renderStrip
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOld = resolve
        }),
      )
      .mockResolvedValueOnce({ blob: editedPhoto, width: 1200, height: 1910 })

    const first = renderSessionForOutput({ ...params, signal: controller.signal })
    const aborted = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(mocks.renderStrip).toHaveBeenCalledTimes(1))
    controller.abort()

    const replacement = renderSessionForOutput(params)
    expect(replacement).not.toBe(first)
    expect((await replacement).render.blob).toBe(editedPhoto)

    finishOld({ blob: photo, width: 1200, height: 1910 })
    await aborted
    expect(mocks.createRender).toHaveBeenCalledTimes(1)
    expect(mocks.createRender.mock.calls[0][0].blob).toBe(editedPhoto)
    expect(mocks.deleteShots).toHaveBeenCalledTimes(1)
    expect(mocks.deleteAssets).toHaveBeenCalledTimes(1)
  })

  it('leaves sources alone if navigation aborts an in-flight database save', async () => {
    const controller = new AbortController()
    let finishSave!: (id: string) => void
    mocks.createRender.mockReturnValue(
      new Promise((resolve) => {
        finishSave = resolve
      }),
    )

    const job = renderSessionForOutput({ ...params, signal: controller.signal })
    const aborted = expect(job).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(mocks.createRender).toHaveBeenCalledTimes(1))
    controller.abort()
    finishSave('already-saved')

    await aborted
    expect(mocks.deleteRender).toHaveBeenCalledWith('already-saved')
    expect(mocks.updateDecoration).not.toHaveBeenCalled()
    expect(mocks.deleteShots).not.toHaveBeenCalled()
    expect(mocks.deleteAssets).not.toHaveBeenCalled()
  })

  it('rejects inside the finalization transaction so interrupted cleanup rolls back', async () => {
    const controller = new AbortController()
    mocks.deleteShots.mockImplementation(async () => controller.abort())

    await expect(
      renderSessionForOutput({ ...params, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.deleteShots).toHaveBeenCalledWith(params.sessionId)
    expect(mocks.deleteAssets).not.toHaveBeenCalled()
    expect(mocks.deleteOldRenders).not.toHaveBeenCalled()
    expect(mocks.deleteRender).toHaveBeenCalledWith('saved-render')
  })

  it('propagates rendering failures without writing or clearing the source session', async () => {
    mocks.renderStrip.mockRejectedValue(new Error('Decode failed'))
    await expect(renderSessionForOutput(params)).rejects.toThrow('Decode failed')
    expect(mocks.createRender).not.toHaveBeenCalled()
    expect(mocks.deleteShots).not.toHaveBeenCalled()
  })
})
