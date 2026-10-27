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
import { AdminReviewsPage } from '@/pages/AdminReviewsPage';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { StoreHomePage } from '@/pages/store/StoreHomePage';
import { StoreProductPage } from '@/pages/store/StoreProductPage';
import { StoreExperiencePage } from '@/pages/store/StoreExperiencePage';
import { StoreAboutPage } from '@/pages/store/StoreAboutPage';

export default function App() {
  return (
    <Routes>
      {/* Standalone public page: the destination of every QR code. */}
      <Route path="view/:variantId" element={<ViewPage />} />
      <Route path="admin" element={<AdminDemoRequestsPage />} />
      <Route path="admin/models/new" element={<AdminModelUploadPage />} />
      <Route path="admin/reviews" element={<AdminReviewsPage />} />
      {/* Client storefronts: their own chrome and brand kit, never the Akruti layout. */}
      <Route path="store/:brandSlug" element={<StoreLayout />}>
        <Route index element={<StoreHomePage />} />
        <Route path="p/:productSlug" element={<StoreProductPage />} />
        <Route path="experience" element={<StoreExperiencePage />} />
        <Route path="about" element={<StoreAboutPage />} />
      </Route>
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
