import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { AboutPage } from '@/pages/AboutPage';
import { ExperiencePage } from '@/pages/ExperiencePage';
import { ModelPage } from '@/pages/ModelPage';
import { ViewPage } from '@/pages/ViewPage';

export default function App() {
  return (
    <Routes>
      {/* Standalone public page: the destination of every QR code. */}
      <Route path="view/:variantId" element={<ViewPage />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="experience" element={<ExperiencePage />} />
        <Route path="3d-model" element={<ModelPage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}
