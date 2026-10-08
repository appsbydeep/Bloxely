import React, { useRef, useEffect, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useDashboardSelectors } from '../hooks/useDashboardSelectors';
import { useDashboardActions } from '../hooks/useDashboardActions';
import { useBeforeUnload } from '../hooks/useBeforeUnload';
import FreeLayoutManager from './GridLayoutManager';
import WidgetRenderer from './WidgetRenderer';
import PersistenceStatus from './PersistenceStatus';
import ThemeToggle from './ThemeToggle';
import WallpaperSelector from './WallpaperSelector';
import WidgetDropdown from './WidgetDropdown';
import FloatingControlPanel from './FloatingControlPanel';
import type { WidgetType } from '../types/dashboard';
import type { WorkspacePlan } from '../types/workspace';
import { buildWorkspace, createWorkspacePlan } from '../services/workspacePlan';
import { generateAiWorkspacePlan } from '../services/aiWorkspacePlan';
import BrainDumpInput from './BrainDumpInput';
import WorkspacePlanReview from './WorkspacePlanReview';

const Dashboard: React.FC = () => {
  const { state, isLoading, persistenceEnabled } = useDashboard();
  const { hasWidgets, widgets } = useDashboardSelectors();
  const { addWidget, confirmWorkspacePlan, updateBlockLayout } = useDashboardActions();
  const [brainDump, setBrainDump] = useState('');
  const [plan, setPlan] = useState<WorkspacePlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const appContainerRef = useRef<HTMLDivElement | null>(null);

  // Save state before page unload
  useBeforeUnload();
  
  // Expose global function for updating widget positions from GridLayoutManager
  useEffect(() => {
    (window as any).updateWidgetLayout = (widgetId: string, x: number, y: number) => {
      // This function will update the dashboard state with new positions
      // For now, we'll trigger a force save to ensure position is persisted
      // In future, we could update the actual layout state here
      console.log('Updating widget position:', widgetId, x, y);
    };
    
    // Expose function to manually save all widget positions and states
    (window as any).saveAllWidgetStates = () => {
      // Save all current widget positions from localStorage
      console.log('Manually saving all widget states...');
      
      // Get all widget position keys
      const positionKeys = [];
      const sizeKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('widget-position-')) {
          positionKeys.push(key);
        } else if (key?.startsWith('widget-size-')) {
          sizeKeys.push(key);
        }
      }
      
      console.log(`Found ${positionKeys.length} widget positions and ${sizeKeys.length} widget sizes to save`);
      return { positions: positionKeys.length, sizes: sizeKeys.length };
    };
    
    return () => {
      delete (window as any).updateWidgetLayout;
      delete (window as any).saveAllWidgetStates;
    };
  }, []);

  const handleAddWidget = (widgetType: WidgetType) => {
    addWidget(widgetType);
  };

  const handlePlan = async () => {
    if (planning || !brainDump.trim()) return;
    setPlanning(true);
    setPlanError(null);
    try {
      setPlan(await generateAiWorkspacePlan(brainDump));
    } catch {
      setPlanError("Bloxely couldn't build your plan. Try again.");
    } finally {
      setPlanning(false);
    }
  };

  const handleBasicPlan = () => {
    try {
      setPlan(createWorkspacePlan(brainDump));
      setPlanError(null);
    } catch {
      setPlanError("Bloxely couldn't build your plan. Try again.");
    }
  };

  const handleConfirm = () => {
    if (!plan) return;
    try {
      confirmWorkspacePlan(buildWorkspace(plan));
      setPlan(null);
      setPlanError(null);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Could not build your workspace.');
    }
  };

  const showEntry = !state.workspace && !hasWidgets;

  // Show loading state while initializing
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center transition-colors duration-300">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <h2 className="text-xl text-slate-800 dark:text-slate-200 mb-2">Loading Dashboard</h2>
          <p className="text-slate-600 dark:text-slate-400">
            {persistenceEnabled ? 'Restoring your workspace...' : 'Initializing...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={appContainerRef} className="app-container min-h-screen w-full relative">
      <header className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/50 p-4 shadow-lg transition-colors duration-300 relative z-[100]">
        <div className="w-full px-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bloxely</h1>
          <div className="flex items-center gap-3">
            <WallpaperSelector />
            <ThemeToggle />
            {!showEntry && <WidgetDropdown onAddWidget={handleAddWidget} />}
          </div>
        </div>
      </header>

      <main
        ref={canvasRef}
        className="canvas-container w-full p-0 m-0 min-h-screen relative z-[1] transition-colors duration-300"
      >
        {showEntry ? (
          plan ? (
            <WorkspacePlanReview plan={plan} onChange={setPlan} onBack={() => { setPlan(null); setPlanError(null); }} onConfirm={handleConfirm} error={planError} />
          ) : (
            <>
              <BrainDumpInput value={brainDump} onChange={setBrainDump} onBuild={handlePlan} loading={planning} />
              {planError && <div className="text-center"><p role="alert" className="text-red-600">{planError}</p><div className="mt-3 flex justify-center gap-4"><button type="button" onClick={handlePlan} className="font-medium text-indigo-600 hover:underline">Retry</button><button type="button" onClick={handleBasicPlan} className="font-medium text-indigo-600 hover:underline">Use basic planner</button></div></div>}
            </>
          )
        ) : (
          <div className="canvas-content">
            <FreeLayoutManager generatedBlocks={state.workspace?.blocks} onGeneratedLayoutChange={updateBlockLayout}>
              {Object.values(widgets).map((widget) => (
                <WidgetRenderer key={widget.id} widget={widget} />
              ))}
            </FreeLayoutManager>
          </div>
        )}
      </main>

      {/* Persistence status indicator */}
      <PersistenceStatus />

      {/* Floating control panel */}
      {!showEntry && <FloatingControlPanel appContainerRef={appContainerRef} />}
    </div>
  );
};

export default Dashboard;
