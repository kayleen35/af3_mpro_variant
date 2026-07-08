import React from 'react';
import { Outlet } from 'react-router-dom';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#070b18] text-gray-100 flex flex-col antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Topbar: Fixed Header */}
      <Topbar />

      {/* Main Body: Sidebar + Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Fixed Left Navigation */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-gradient-to-b from-[#070b18] via-[#080d1e] to-[#070b18]">
          <div className="max-w-7xl mx-auto min-h-[calc(100vh-10rem)] flex flex-col justify-between">
            {/* Page Router Outlet */}
            <div className="flex-1">
              <Outlet />
            </div>

            {/* Subtle Research Disclaimer Footer */}
            <footer className="mt-12 pt-6 border-t border-[#243047]/60 text-center text-xs text-gray-500">
              <p>
                Mpro-Variant Binder Research Platform &bull; Powered by Local Ubuntu AlphaFold3 &bull;{' '}
                <span className="text-violet-400 font-medium">Research Only (Not for Clinical Use)</span>
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
