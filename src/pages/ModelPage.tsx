import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';

/** Drop a licensed/owned clip at public/videos/construction.mp4 to show it here. */
const PREVIEW_VIDEO_SRC = '/videos/construction.mp4';

/** Placeholder for the upcoming 3D model viewer, with a looping preview video. */
export function ModelPage() {
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <section aria-label="3D Model" className="flex min-h-screen flex-col items-center justify-center px-6 pb-16 pt-28 text-center md:pt-32">
      <Badge className="mb-6">3D Model</Badge>
      <h1 className="text-4xl font-light tracking-tighter text-fg md:text-6xl">Upcoming feature</h1>
      {!videoFailed && (
        <video
          src={PREVIEW_VIDEO_SRC}
          autoPlay
          loop
          muted
          playsInline
          aria-label="Construction preview animation"
          onError={() => setVideoFailed(true)}
          className="mt-10 w-full max-w-4xl rounded-2xl"
        />
      )}
    </section>
  );
}
