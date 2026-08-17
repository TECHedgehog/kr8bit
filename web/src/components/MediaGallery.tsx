import { useEffect, useMemo, useState } from 'react';

import type { Game } from '../api/types';
import { VideoPlayer } from './VideoPlayer';

interface MediaItem {
  type: 'screenshot' | 'video';
  url: string;
  thumbnailUrl: string;
  name?: string;
  hlsUrl?: string;
}

interface MediaGalleryProps {
  screenshots?: Game['screenshots'];
  videos?: Game['videos'];
}

export function MediaGallery({ screenshots = [], videos = [] }: MediaGalleryProps): JSX.Element {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const media: MediaItem[] = useMemo(() => {
    const v = videos.map((v) => ({
      type: 'video' as const,
      url: v.url,
      thumbnailUrl: v.thumbnailUrl,
      name: v.name,
      hlsUrl: v.hlsUrl,
    }));
    const s = screenshots.map((s) => ({
      type: 'screenshot' as const,
      url: s.url,
      thumbnailUrl: s.thumbnailUrl,
    }));
    return [...v, ...s];
  }, [videos, screenshots]);

  useEffect(() => {
    if (media.length > 0 && !selectedMedia) {
      setSelectedMedia(media[0]);
    }
  }, [media, selectedMedia]);

  const isVideo = (selectedMedia?.type || media[0]?.type || 'screenshot') === 'video';

  const handleThumbnailClick = (item: MediaItem) => {
    setSelectedMedia(item);
  };

  if (media.length === 0) {
    return (
      <div className="detail-section">
        <div className="detail-section-title">Gallery</div>
        <div className="game-detail-screenshots-placeholder">
          <span>No media available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-section">
      <div className="detail-section-title">Gallery</div>
      <div className="media-gallery">
        <div className="media-gallery-main">
          {isVideo && selectedMedia ? (
            <div className="media-gallery-video-wrapper">
              <VideoPlayer
                src={selectedMedia.url}
                hlsUrl={selectedMedia.hlsUrl}
                poster={selectedMedia.thumbnailUrl}
                defaultMuted
                className="media-gallery-video"
              />
            </div>
          ) : !isVideo && selectedMedia ? (
            <img
              src={selectedMedia.url}
              alt={selectedMedia.name || 'Screenshot'}
              className="media-gallery-image"
            />
          ) : null}
        </div>
        <div className="media-gallery-thumbs">
          {media.map((item, idx) => (
            <button
              key={item.url + idx}
              className={`media-gallery-thumb ${selectedMedia?.url === item.url ? 'is-selected' : ''}`}
              onClick={() => handleThumbnailClick(item)}
              aria-label={`Select ${item.type} ${idx + 1}`}
            >
              <img src={item.thumbnailUrl} alt="" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
