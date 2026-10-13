/** Why a video cannot be published yet, or null if it can. Shared by the review queue and the server actions. */
export function publishBlocker(v: {
  provider: string
  providerRef: string | null
  muxAssetId: string | null
  mediaStatus: string
  categoryId: string | null
}): string | null {
  if (v.provider === 'mux') {
    if (!v.muxAssetId) return 'Upload the video before publishing.'
    if (v.mediaStatus === 'processing') return 'The video is still processing. Try again in a few minutes.'
    if (v.mediaStatus === 'errored') return 'The video failed to process. Upload it again.'
  } else if (!v.providerRef) {
    return 'Attach a video before publishing.'
  }
  if (!v.categoryId) return 'Choose a category before publishing.'
  return null
}
