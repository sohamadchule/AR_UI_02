import { HeroSection } from '@/features/hero/HeroSection';
import { VisionSection } from '@/features/vision/VisionSection';
import { HowItWorksSection } from '@/features/how/HowItWorksSection';
import { StorefrontsSection } from '@/features/showcase/StorefrontsSection';
import { ConfiguratorSection } from '@/features/configurator/ConfiguratorSection';
import { ValueSection } from '@/features/value/ValueSection';
import { CtaSection } from '@/features/cta/CtaSection';

export function HomePage() {
  return (
    <>
      <HeroSection />
      <VisionSection />
      <ConfiguratorSection />
      <HowItWorksSection />
      <ValueSection />
      <StorefrontsSection />
      <CtaSection />
    </>
  );
}
