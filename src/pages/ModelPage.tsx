import { Badge } from '@/components/ui/Badge';

/** Placeholder for the upcoming 3D model viewer. */
export function ModelPage() {
  return (
    <section aria-label="3D Model" className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Badge className="mb-6">3D Model</Badge>
      <h1 className="text-4xl font-light tracking-tighter text-fg md:text-6xl">Upcoming feature</h1>
    </section>
  );
}
