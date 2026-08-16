import { useState, useRef, useEffect, useMemo } from 'react';
import Hls from 'hls.js';
import IconMaximize from '@tabler/icons-react/dist/esm/icons/IconMaximize.mjs';
import IconX from '@tabler/icons-react/dist/esm/icons/IconX.mjs';
import IconChevronLeft from '@tabler/icons-react/dist/esm/icons/IconChevronLeft.mjs';
import IconChevronRight from '@tabler/icons-react/dist/esm/icons/IconChevronRight.mjs';
import IconZoomIn from '@tabler/icons-react/dist/esm/icons/IconZoomIn.mjs';
import IconZoomOut from '@tabler/icons-react/dist/esm/icons/IconZoomOut.mjs';
import IconPlayerPlay from '@tabler/icons-react/dist/esm/icons/IconPlayerPlay.mjs';
import IconPlayerPause from '@tabler/icons-react/dist/esm/icons/IconPlayerPause.mjs';
import IconVolume from '@tabler/icons-react/dist/esm/icons/IconVolume.mjs';
import IconVolumeOff from '@tabler/icons-react/dist/esm/icons/IconVolumeOff.mjs';

import type { Game } from '../api/types';

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

function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function MediaGallery({ screenshots = [], videos = [] }: MediaGalleryProps): JSX.Element {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const lightboxVideoRef = useRef<HTMLVideoElement>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const inlineHlsRef = useRef<Hls | null>(null);
  const lastLightboxTime = useRef<number>(0);
  const isDraggingTimeline = useRef<boolean>(false);

  const media: MediaItem[] = useMemo(() => {
    const v = videos.map((v) => ({ type: 'video' as const, url: v.url, thumbnailUrl: v.thumbnailUrl, name: v.name, hlsUrl: v.hlsUrl }));
    const s = screenshots.map((s) => ({ type: 'screenshot' as const, url: s.url, thumbnailUrl: s.thumbnailUrl }));
    return [...v, ...s];
  }, [videos, screenshots]);

  useEffect(() => {
    if (media.length > 0 && !selectedMedia) {
      setSelectedMedia(media[0]);
    }
  }, [media, selectedMedia]);

  useEffect(() => {
    if (isLightboxOpen && selectedMedia?.type === 'video' && lightboxVideoRef.current) {
      const video = lightboxVideoRef.current;
      video.muted = isMuted;
      video.volume = volume;
      if (inlineVideoRef.current) {
        video.currentTime = inlineVideoRef.current.currentTime;
        lastLightboxTime.current = inlineVideoRef.current.currentTime;
      }
      video.play().catch(() => {});
    } else if (lightboxVideoRef.current) {
      lightboxVideoRef.current.pause();
    }
  }, [isLightboxOpen, selectedMedia, isMuted, volume]);

  useEffect(() => {
    if (!isLightboxOpen && selectedMedia?.type === 'video' && inlineVideoRef.current) {
      const video = inlineVideoRef.current;
      video.muted = isMuted;
      video.volume = volume;
      video.currentTime = lastLightboxTime.current;
      video.play().catch(() => {});
    } else if (inlineVideoRef.current) {
      inlineVideoRef.current.pause();
    }
  }, [isLightboxOpen, selectedMedia, isMuted, volume]);

  const isVideo = (selectedMedia?.type || media[0]?.type || 'screenshot') === 'video';

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isLightboxOpen) return;
      if (e.key === 'Escape') {
        if (lightboxVideoRef.current) {
          lastLightboxTime.current = lightboxVideoRef.current.currentTime;
        }
        setIsLightboxOpen(false);
        setZoom(1);
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (!isVideo && (e.key === '+' || e.key === '=')) {
        setZoom((z) => Math.min(z + 0.25, 4));
      } else if (!isVideo && (e.key === '-' || e.key === '_')) {
        setZoom((z) => Math.max(z - 0.25, 0.5));
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isLightboxOpen, media, selectedMedia, isVideo]);

  const handleNext = () => {
    if (!selectedMedia || media.length === 0) return;
    const idx = media.findIndex((m) => m.url === selectedMedia.url);
    const nextIdx = (idx + 1) % media.length;
    setSelectedMedia(media[nextIdx]);
    setZoom(1);
  };

  const handlePrev = () => {
    if (!selectedMedia || media.length === 0) return;
    const idx = media.findIndex((m) => m.url === selectedMedia.url);
    const prevIdx = (idx - 1 + media.length) % media.length;
    setSelectedMedia(media[prevIdx]);
    setZoom(1);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isLightboxOpen || isVideo) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom((z) => Math.max(0.5, Math.min(4, z + delta)));
  };

  const handleThumbnailClick = (item: MediaItem) => {
    setSelectedMedia(item);
    setZoom(1);
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVideoPlay = () => setIsPlaying(true);
  const handleVideoPause = () => setIsPlaying(false);
  const handleVideoVolumeChange = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setVolume(video.volume);
    setIsMuted(video.muted);
  };
  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setCurrentTime(e.currentTarget.currentTime);
  };
  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration);
  };
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>, videoRef: React.RefObject<HTMLVideoElement>) => {
    if (!videoRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    videoRef.current.currentTime = newTime;
  };

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>, videoRef: React.RefObject<HTMLVideoElement>) => {
    if (!videoRef.current || duration === 0) return;
    handleTimelineClick(e, videoRef);
    isDraggingTimeline.current = true;
  };

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDraggingTimeline.current) return;
      const timeline = document.querySelector('.media-lightbox-timeline') as HTMLElement;
      if (timeline) {
        const rect = timeline.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const newTime = Math.max(0, Math.min((clickX / rect.width) * duration, duration));
        if (lightboxVideoRef.current) {
          lightboxVideoRef.current.currentTime = newTime;
        }
      }
    }

    function handleMouseUp() {
      isDraggingTimeline.current = false;
    }

    if (isDraggingTimeline.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [duration, lightboxVideoRef]);
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleVideoClick = (ref: React.RefObject<HTMLVideoElement>) => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
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

  const needsHls = selectedMedia?.hlsUrl || (selectedMedia?.url || '').endsWith('.m3u8');
  const hasHls = needsHls && !isSafari();

  useEffect(() => {
    if (isLightboxOpen && hasHls && selectedMedia && lightboxVideoRef.current) {
      const video = lightboxVideoRef.current;
      if (Hls.isSupported()) {
        if (hlsInstanceRef.current) {
          hlsInstanceRef.current.destroy();
        }
        const hls = new Hls();
        hls.loadSource(selectedMedia.hlsUrl || selectedMedia.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            hls.destroy();
          }
        });
        hlsInstanceRef.current = hls;
      }
    }
    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [isLightboxOpen, selectedMedia, hasHls]);

  useEffect(() => {
    if (hasHls && selectedMedia && inlineVideoRef.current) {
      const video = inlineVideoRef.current;
      if (Hls.isSupported()) {
        if (inlineHlsRef.current) {
          inlineHlsRef.current.destroy();
        }
        const hls = new Hls();
        hls.loadSource(selectedMedia.hlsUrl || selectedMedia.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            hls.destroy();
          }
        });
        inlineHlsRef.current = hls;
      }
    }
    return () => {
      if (inlineHlsRef.current) {
        inlineHlsRef.current.destroy();
        inlineHlsRef.current = null;
      }
    };
  }, [selectedMedia, hasHls]);

  return (
    <div className="detail-section">
      <div className="detail-section-title">Gallery</div>
      <div className="media-gallery">
        <div className="media-gallery-main">
          {isVideo && selectedMedia ? (
            <div className="media-gallery-video-wrapper">
              <div className="media-gallery-volume-corner">
                <button
                  className="media-gallery-volume-corner-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMuteToggle();
                  }}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                      {isMuted ? <IconVolumeOff size={24} /> : <IconVolume size={24} />}
                </button>
                <input
                  className="media-gallery-volume-corner-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Volume"
                  style={{ '--vol': `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
                />
              </div>
              <video
                ref={inlineVideoRef}
                src={hasHls ? undefined : selectedMedia.url}
                poster={selectedMedia.thumbnailUrl}
                className="media-gallery-video"
                loop
                playsInline
                muted={isMuted}
                onClick={() => handleVideoClick(inlineVideoRef)}
                onPlay={handleVideoPlay}
                onPause={handleVideoPause}
                onVolumeChange={handleVideoVolumeChange}
                onTimeUpdate={handleVideoTimeUpdate}
                onLoadedMetadata={handleVideoLoadedMetadata}
              />
              <div className="media-gallery-video-controls">
                <button
                  className="media-gallery-play-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inlineVideoRef.current) {
                      if (isPlaying) {
                        inlineVideoRef.current.pause();
                      } else {
                        inlineVideoRef.current.play().catch(() => {});
                      }
                    }
                  }}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <IconPlayerPause size={32} /> : <IconPlayerPlay size={32} />}
                </button>
                 <div className="media-gallery-timeline" onClick={(e) => handleTimelineClick(e, inlineVideoRef)} onMouseDown={(e) => handleTimelineMouseDown(e, inlineVideoRef)}>
                  <div
                    className="media-gallery-timeline-fill"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                </div>
                <span className="media-gallery-time">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
            </div>
          ) : !isVideo && selectedMedia ? (
              <img
                src={selectedMedia.url}
                alt={selectedMedia.name || 'Screenshot'}
                className="media-gallery-image"
                style={{ transform: `scale(${zoom})` }}
              />
            ) : null
          }
          <button
            className="media-gallery-maximize"
            onClick={(e) => {
              e.stopPropagation();
              setIsLightboxOpen(true);
            }}
            aria-label="Maximize"
          >
            <IconMaximize size={20} />
          </button>
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

      {isLightboxOpen && (
        <div className="media-lightbox" onClick={(e) => {
          if (e.target === e.currentTarget && lightboxVideoRef.current) {
            lastLightboxTime.current = lightboxVideoRef.current.currentTime;
          }
          setIsLightboxOpen(false);
        }}>
          <div className="media-lightbox-content" onWheel={handleWheel}>
            <button
              className="media-lightbox-close"
              onClick={() => {
                if (lightboxVideoRef.current) {
                  lastLightboxTime.current = lightboxVideoRef.current.currentTime;
                }
                setIsLightboxOpen(false);
                setZoom(1);
              }}
              aria-label="Close"
            >
              <IconX size={24} />
            </button>
            <button
              className="media-lightbox-nav media-lightbox-nav--prev"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              aria-label="Previous"
            >
              <IconChevronLeft size={48} />
            </button>
            <div className="media-lightbox-main" onClick={(e) => e.stopPropagation()}>
              {isVideo && selectedMedia ? (
                <div className="media-lightbox-video-wrapper">
                  <div className="media-lightbox-volume-corner">
                    <button
                      className="media-lightbox-volume-corner-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMuteToggle();
                      }}
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                    >
                       {isMuted ? <IconVolumeOff size={28} /> : <IconVolume size={28} />}
                    </button>
                    <input
                      className="media-lightbox-volume-corner-slider"
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Volume"
                      style={{ '--vol': `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
                    />
                  </div>
                  <video
                    ref={lightboxVideoRef}
                    src={hasHls ? undefined : selectedMedia.url}
                    poster={selectedMedia.thumbnailUrl}
                    className="media-lightbox-video"
                    loop
                    playsInline
                    muted={isMuted}
                    onClick={() => handleVideoClick(lightboxVideoRef)}
                    onPlay={handleVideoPlay}
                    onPause={handleVideoPause}
                    onVolumeChange={handleVideoVolumeChange}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onLoadedMetadata={handleVideoLoadedMetadata}
                  />
                   <div className="media-lightbox-video-controls">
                     <button
                       className="media-lightbox-play-toggle"
                       onClick={(e) => {
                         e.stopPropagation();
                         if (lightboxVideoRef.current) {
                           if (isPlaying) {
                             lightboxVideoRef.current.pause();
                           } else {
                             lightboxVideoRef.current.play().catch(() => {});
                           }
                         }
                       }}
                       aria-label={isPlaying ? 'Pause' : 'Play'}
                     >
                       {isPlaying ? <IconPlayerPause size={32} /> : <IconPlayerPlay size={32} />}
                     </button>
                     <div
                       className="media-lightbox-timeline"
                       onClick={(e) => handleTimelineClick(e, lightboxVideoRef)}
                       onMouseDown={(e) => handleTimelineMouseDown(e, lightboxVideoRef)}
                     >
                       <div
                         className="media-lightbox-timeline-fill"
                         style={{ width: `${(currentTime / duration) * 100}%` }}
                       />
                     </div>
                      <span className="media-lightbox-time">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>
                 </div>
              ) : !isVideo && selectedMedia ? (
                  <img
                    src={selectedMedia.url}
                    alt={selectedMedia.name || 'Screenshot'}
                    className="media-lightbox-image"
                    style={{ transform: `scale(${zoom})` }}
                  />
                ) : null
              }
            </div>
            <button
              className="media-lightbox-nav media-lightbox-nav--next"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              aria-label="Next"
            >
              <IconChevronRight size={48} />
            </button>
            {!isVideo && (
              <div className="media-lightbox-controls">
                <button
                  className="media-lightbox-zoom media-lightbox-zoom--out"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoom((z) => Math.max(0.5, z - 0.25));
                  }}
                  aria-label="Zoom out"
                >
                  <IconZoomOut size={20} />
                </button>
                <span className="media-lightbox-zoom-level">{Math.round(zoom * 100)}%</span>
                <button
                  className="media-lightbox-zoom media-lightbox-zoom--in"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoom((z) => Math.min(4, z + 0.25));
                  }}
                  aria-label="Zoom in"
                >
                  <IconZoomIn size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
