import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

import DashboardPage from '../pages/DashboardPage';
import SequenceInputPage from '../pages/SequenceInputPage';
import MutationAnalysisPage from '../pages/MutationAnalysisPage';
import BindingPredictionPage from '../pages/BindingPredictionPage';
import InhibitorComparisonPage from '../pages/InhibitorComparisonPage';
import StructureViewerPage from '../pages/StructureViewerPage';
import ResearchReportPage from '../pages/ResearchReportPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="sequence" element={<SequenceInputPage />} />
        <Route path="mutation" element={<MutationAnalysisPage />} />
        <Route path="prediction" element={<BindingPredictionPage />} />
        <Route path="comparison" element={<InhibitorComparisonPage />} />
        <Route path="viewer" element={<StructureViewerPage />} />
        <Route path="report" element={<ResearchReportPage />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
