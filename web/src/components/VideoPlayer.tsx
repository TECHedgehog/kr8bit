import { useCallback, type ReactNode } from 'react';
import {
  MediaPlayer,
  MediaProvider,
  isHLSProvider,
  isHLSSrc,
  type HLSProvider,
} from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';

interface VideoPlayerProps {
  src: string;
  hlsUrl?: string;
  poster?: string;
  defaultMuted?: boolean;
  startTime?: number;
  className?: string;
}

export function VideoPlayer({
  src,
  hlsUrl,
  poster,
  defaultMuted = true,
  startTime,
  className,
}: VideoPlayerProps): ReactNode {
  const sourceUrl = hlsUrl || src;
  const mediaSrc = isHLSSrc({ src: sourceUrl, type: 'video/mp4' })
    ? { src: sourceUrl, type: 'application/x-mpegurl' as const }
    : { src: sourceUrl, type: 'video/mp4' as const };

  const handleProviderChange = useCallback((provider: unknown) => {
    if (provider && isHLSProvider(provider)) {
      (provider as HLSProvider).library = () => import('hls.js');
    }
  }, []);

  return (
    <MediaPlayer
      className={className}
      src={mediaSrc}
      poster={poster}
      muted={defaultMuted}
      volume={1}
      autoPlay
      loop
      playsInline
      streamType="on-demand"
      currentTime={startTime}
      load="eager"
      onProviderChange={handleProviderChange}
    >
      <MediaProvider />
      <DefaultVideoLayout
        icons={defaultLayoutIcons}
        slots={{ captionButton: null, settingsMenu: null }}
      />
    </MediaPlayer>
  );
}
