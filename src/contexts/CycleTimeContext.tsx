'use client';

import React, { createContext, useContext, useState } from 'react';

interface CycleTimeContextType {
  activeTab: 'quarter' | 'complexity';
  setActiveTab: (tab: 'quarter' | 'complexity') => void;
}

const CycleTimeContext = createContext<CycleTimeContextType | undefined>(undefined);

export function CycleTimeProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<'quarter' | 'complexity'>('quarter');

  return (
    <CycleTimeContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </CycleTimeContext.Provider>
  );
}

export function useCycleTimeContext() {
  const context = useContext(CycleTimeContext);
  if (context === undefined) {
    throw new Error('useCycleTimeContext must be used within a CycleTimeProvider');
  }
  return context;
}
