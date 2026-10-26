import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { AboutPage } from '@/pages/AboutPage';
import { ExperiencePage } from '@/pages/ExperiencePage';
import { ModelPage } from '@/pages/ModelPage';
import { ViewPage } from '@/pages/ViewPage';
import { RequestDemoPage } from '@/pages/RequestDemoPage';
import { VerifyDemoEmailPage } from '@/pages/VerifyDemoEmailPage';
import { AdminDemoRequestsPage } from '@/pages/AdminDemoRequestsPage';
import { AdminModelUploadPage } from '@/pages/AdminModelUploadPage';

export default function App() {
  return (
    <Routes>
      {/* Standalone public page: the destination of every QR code. */}
      <Route path="view/:variantId" element={<ViewPage />} />
      <Route path="admin" element={<AdminDemoRequestsPage />} />
      <Route path="admin/models/new" element={<AdminModelUploadPage />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="experience" element={<ExperiencePage />} />
        <Route path="request-demo" element={<RequestDemoPage />} />
        <Route path="request-demo/verify" element={<VerifyDemoEmailPage />} />
        <Route path="3d-model" element={<ModelPage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}
