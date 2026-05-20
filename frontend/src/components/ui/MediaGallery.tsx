import { useState, useMemo } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Video from 'yet-another-react-lightbox/plugins/video'
import 'yet-another-react-lightbox/styles.css'
import type { GameScreenshot, GameVideo } from '../../types'
import { Play } from 'lucide-react'

interface MediaGalleryProps {
  screenshots: GameScreenshot[]
  videos: GameVideo[]
}

export default function MediaGallery({ screenshots, videos }: MediaGalleryProps) {
  const [index, setIndex] = useState(-1)
  const [selected, setSelected] = useState(0)

  // Combine media: videos first (highlights first), then screenshots
  const media = useMemo(() => {
    const vids = [...videos].sort((a, b) => (b.is_highlight ? 1 : 0) - (a.is_highlight ? 1 : 0))
    return [
      ...vids.map(v => ({ type: 'video' as const, data: v })),
      ...screenshots.map(s => ({ type: 'image' as const, data: s })),
    ]
  }, [screenshots, videos])

  if (media.length === 0) return null

  const current = media[selected]

  const slides = media.map(m => {
    if (m.type === 'video') {
      return {
        type: 'video' as const,
        sources: [
          { src: m.data.mp4_url, type: 'video/mp4' },
          ...(m.data.webm_url ? [{ src: m.data.webm_url, type: 'video/webm' }] : []),
        ],
        poster: m.data.thumbnail_url,
        title: m.data.name,
      }
    }
    return {
      src: m.data.full_url,
      title: '',
    }
  })

  return (
    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
        Media
      </h2>

      {/* Main display */}
      <div
        className="relative rounded-lg overflow-hidden border border-[var(--border)] mb-3 aspect-video bg-black cursor-pointer group"
        onClick={() => setIndex(selected)}
      >
        {current.type === 'image' ? (
          <img
            src={current.data.full_url}
            alt=""
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="relative w-full h-full">
            <img
              src={current.data.thumbnail_url}
              alt={current.data.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-white fill-white" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {media.map((m, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`relative shrink-0 w-24 h-14 rounded overflow-hidden border transition-all ${
              i === selected
                ? 'border-[var(--accent)] opacity-100'
                : 'border-[var(--border)] opacity-60 hover:opacity-100'
            }`}
          >
            <img
              src={m.type === 'video' ? m.data.thumbnail_url : m.data.thumbnail_url}
              alt=""
              className="w-full h-full object-cover"
            />
            {m.type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Play className="w-3 h-3 text-white fill-white drop-shadow" />
              </div>
            )}
          </button>
        ))}
      </div>

      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={slides}
        plugins={[Video]}
      />
    </div>
  )
}
