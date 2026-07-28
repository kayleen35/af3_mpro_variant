import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

import {
  DashboardPage,
  SequenceInputPage,
  MutationAnalysisPage,
  ScreeningPage,
  BindingPredictionPage,
  InteractionComparisonPage,
  MoleculeHighlightPage,
  OptimizationPage,
  ReevaluationPage,
  FinalRankingPage,
  InhibitorComparisonPage,
  StructureViewerPage,
  ResearchReportPage
} from '../pages';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="sequence" element={<SequenceInputPage />} />
        <Route path="mutation" element={<MutationAnalysisPage />} />
        <Route path="screening" element={<ScreeningPage />} />
        <Route path="prediction" element={<BindingPredictionPage />} />
        <Route path="interaction" element={<InteractionComparisonPage />} />
        <Route path="molecule" element={<MoleculeHighlightPage />} />
        <Route path="optimization" element={<OptimizationPage />} />
        <Route path="reevaluation" element={<ReevaluationPage />} />
        <Route path="final-ranking" element={<FinalRankingPage />} />
        <Route path="comparison" element={<InhibitorComparisonPage />} />
        <Route path="viewer" element={<StructureViewerPage />} />
        <Route path="report" element={<ResearchReportPage />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
