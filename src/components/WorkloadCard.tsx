import React from 'react';
import { WorkloadData } from '@/types/jira';
import Sparkline from './Sparkline';
import HealthBadges from './HealthBadges';

interface WorkloadCardProps {
  member: WorkloadData;
  trendData: { data: number[]; dates: string[] };
  globalMaxProjects: number;
}

const WorkloadCard = React.memo(({ member, trendData, globalMaxProjects }: WorkloadCardProps) => {
  // Use the active project count from the weekly snapshot (member.activeProjectCount)
  // This is the reliable persisted count from the start of the week
  const activeProjectCount = member.activeProjectCount || 0;
  const isOverloaded = activeProjectCount >= 6;
  
  return (
    <div
      className={`relative bg-white p-6 rounded-lg border-2 ${
        isOverloaded 
          ? 'border-red-200 bg-red-50' 
          : 'border-gray-200'
      }`}
    >
      <div className="flex gap-6">
        {/* Left side: Team member info and project health */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {member.teamMember.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
            </div>
            <div className="ml-4 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">
                  {member.teamMember}
                </h3>
                {isOverloaded && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Overloaded
                  </span>
                )}
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {activeProjectCount}
              </p>
              <p className="text-sm text-gray-500">active projects</p>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-2">Project Health</div>
            <HealthBadges 
              healthBreakdown={member.healthBreakdown} 
              projectDetails={member.projectDetails}
            />
          </div>
        </div>

        {/* Right side: Workload Trend Sparkline */}
        <div className="flex-1 max-w-2xl">
          <div className="flex items-center justify-between mb-2 pr-2">
            <div className="text-xs text-gray-500">Workload Trend</div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-gray-600">≤5 Projects</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-gray-600">&gt;5 Projects</span>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <Sparkline
              data={trendData.data}
              dates={trendData.dates}
              height={120}
              color={isOverloaded ? '#EF4444' : '#3B82F6'}
              strokeWidth={2}
              showTooltip={true}
              globalMaxProjects={globalMaxProjects}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

WorkloadCard.displayName = 'WorkloadCard';

export default WorkloadCard;
