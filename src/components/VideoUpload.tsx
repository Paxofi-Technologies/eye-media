'use client'

import { useId, useRef, useState } from 'react'
import { ACCEPTED_VIDEO_LABEL, MAX_UPLOAD_BYTES, formatBytes } from '@/lib/media'

type State =
  | { phase: 'idle' }
  | { phase: 'uploading'; name: string; size: number; sent: number }
  | { phase: 'finishing'; name: string; size: number }
  | { phase: 'done'; name: string; size: number; id: string; token: string }
  | { phase: 'error'; message: string }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function json(res: Response) {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>
}

/**
 * Design-system "Media Drop Zone & Upload Queue". Sends the file straight to Mux in resumable chunks (survives flaky mobile data), then exposes the result to
 * the surrounding form as hidden `uploadId` / `uploadToken` inputs.
 */
export function VideoUpload({
  purpose = 'staff',
  label = 'Upload a video from your device',
  current,
}: {
  purpose?: 'staff'
  label?: string
  current?: string | null
}) {
  const inputId = useId()
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [dragging, setDragging] = useState(false)
  const abort = useRef<AbortController | null>(null)

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) return setState({ phase: 'error', message: 'This video is larger than 500MB.' })
    if (file.size === 0) return setState({ phase: 'error', message: 'This file is empty.' })
    const controller = new AbortController()
    abort.current = controller
    setState({ phase: 'uploading', name: file.name, size: file.size, sent: 0 })
    let uploader: { abort: () => void } | null = null
    controller.signal.addEventListener('abort', () => uploader?.abort())
    try {
      const start = await fetch('/api/uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, name: file.name, size: file.size }),
        signal: controller.signal,
      })
      const created = await json(start)
      if (!start.ok) throw new Error(String(created.error ?? 'Could not start the upload.'))
      const { id, token, url } = created as { id: string; token: string; url: string }

      // The file goes straight from the browser to Mux in resumable chunks; it never passes through our server.
      const { UpChunk } = await import('@mux/upchunk')
      await new Promise<void>((resolve, reject) => {
        const up = UpChunk.createUpload({ endpoint: url, file, chunkSize: 8 * 1024, attempts: 5, delayBeforeAttempt: 2 })
        uploader = up
        up.on('progress', (e: CustomEvent<number>) =>
          setState({ phase: 'uploading', name: file.name, size: file.size, sent: Math.round((e.detail / 100) * file.size) }),
        )
        up.on('error', (e: CustomEvent<{ message?: string }>) => reject(new Error(e.detail?.message || 'Upload failed. Check your connection and try again.')))
        up.on('success', () => resolve())
      })

      // Mux creates the video a moment after the last byte; ask until it exists.
      setState({ phase: 'finishing', name: file.name, size: file.size })
      for (let i = 0; i < 60; i++) {
        const done = await fetch(`/api/uploads/${id}/complete`, {
          method: 'POST',
          headers: { 'x-upload-token': token },
          signal: controller.signal,
        })
        const body = await json(done)
        if (!done.ok) throw new Error(String(body.error ?? 'Could not finish the upload.'))
        if (body.ready) return setState({ phase: 'done', name: file.name, size: file.size, id, token })
        await wait(2000)
      }
      throw new Error('The video service is taking longer than expected. Please try again.')
    } catch (e) {
      if (controller.signal.aborted) return setState({ phase: 'idle' })
      setState({ phase: 'error', message: e instanceof Error ? e.message : 'Upload failed.' })
    }
  }

  const pct = state.phase === 'uploading' ? Math.floor((state.sent / state.size) * 100) : 100

  return (
    <div className="field">
      <span className="label" id={`${inputId}-label`}>
        {label}
      </span>
      <div
        className={`dropzone${dragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file && state.phase !== 'uploading' && state.phase !== 'finishing') void upload(file)
        }}
      >
        <svg className="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M16 16l-4-4-4 4M12 12v9" />
          <path d="M20.4 18.4A5 5 0 0018 9h-1.3A8 8 0 103 16.3" />
        </svg>
        <label htmlFor={inputId} className="dropzone-title">
          {state.phase === 'done' ? 'Choose a different video' : 'Drag & drop or click to upload'}
        </label>
        <input
          id={inputId}
          className="visually-hidden"
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/*"
          aria-describedby={`${inputId}-hint`}
          disabled={state.phase === 'uploading' || state.phase === 'finishing'}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void upload(file)
            e.target.value = ''
          }}
        />
        <p className="dropzone-hint" id={`${inputId}-hint`}>
          Supported: {ACCEPTED_VIDEO_LABEL} (max 500MB). On a phone you can record or pick from your gallery.
        </p>

        {state.phase === 'uploading' && (
          <div className="upload-progress" role="status" aria-live="polite">
            <div className="upload-progress-row">
              <span className="upload-name">{state.name}</span>
              <span className="upload-pct">{pct}%</span>
            </div>
            <div className="upload-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
              <span style={{ width: `${pct}%` }} />
            </div>
            <div className="upload-progress-row">
              <span className="field-hint">
                {formatBytes(state.sent)} of {formatBytes(state.size)}. Keep this page open.
              </span>
              <button type="button" className="link-btn" onClick={() => abort.current?.abort()}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {state.phase === 'finishing' && (
          <p className="field-hint" role="status">
            Finishing {state.name}…
          </p>
        )}
        {state.phase === 'done' && (
          <div className="upload-progress" role="status">
            <div className="upload-progress-row">
              <span className="upload-name">✓ {state.name}</span>
              <span className="upload-pct">{formatBytes(state.size)}</span>
            </div>
            <div className="upload-bar is-done">
              <span style={{ width: '100%' }} />
            </div>
            <span className="field-hint">Uploaded. It will be attached when you submit.</span>
          </div>
        )}
        {state.phase === 'error' && (
          <p className="field-error" role="alert">
            {state.message}
          </p>
        )}
        {state.phase === 'idle' && current && <p className="field-hint">Current file: {current}</p>}
      </div>
      {state.phase === 'done' && (
        <>
          <input type="hidden" name="uploadId" value={state.id} />
          <input type="hidden" name="uploadToken" value={state.token} />
        </>
      )}
    </div>
  )
}
