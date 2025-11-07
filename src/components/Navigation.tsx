'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useCycleTimeContext } from '@/contexts/CycleTimeContext';

const navItems = [
  { href: '/', label: 'Team Workload' },
  { href: '/projects-at-risk', label: 'Projects At Risk' },
  { href: '/trends', label: 'Trends Over Time' },
  { href: '/cycle-time', label: 'Cycle Time Analysis' },
  { href: '/cycle-time-details', label: 'Cycle Time Details' },
  { href: '/capacity-data', label: 'Capacity Data' },
] as const;

const Navigation = React.memo(() => {
  const pathname = usePathname();
  const { activeTab: cycleTimeTab, setActiveTab: onCycleTimeTabChange } = useCycleTimeContext();

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            
            // Special handling for Cycle Time Analysis with dropdown
            if (item.href === '/cycle-time' && pathname === '/cycle-time') {
              return (
                <div key={item.href} className="relative group">
                  <Link
                    href={item.href}
                    className={`border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-1 ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {cycleTimeTab === 'quarter' ? 'By Quarter' : 'By Complexity'}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Link>
                  
                  {/* Dropdown Menu */}
                  <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-1">
                      <button
                        onClick={() => onCycleTimeTabChange('quarter')}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                          cycleTimeTab === 'quarter' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        By Quarter
                      </button>
                      <button
                        onClick={() => onCycleTimeTabChange('complexity')}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                          cycleTimeTab === 'complexity' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        By Complexity
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
            
            // Regular navigation items
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`border-b-2 py-4 px-1 text-sm font-medium ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
});

Navigation.displayName = 'Navigation';

export default Navigation;
