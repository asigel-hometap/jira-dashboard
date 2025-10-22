import React, { useState } from 'react';
import { ProjectDetail } from '@/types/jira';

interface HealthBadgesProps {
  healthBreakdown: {
    onTrack: number;
    atRisk: number;
    offTrack: number;
    onHold: number;
    mystery: number;
    complete: number;
    unknown: number;
  };
  projectDetails: {
    onTrack: ProjectDetail[];
    atRisk: ProjectDetail[];
    offTrack: ProjectDetail[];
    onHold: ProjectDetail[];
    mystery: ProjectDetail[];
    complete: ProjectDetail[];
    unknown: ProjectDetail[];
  };
}

const healthConfig = {
  onTrack: { label: 'On Track', color: 'bg-green-100 text-green-800 border-green-200' },
  atRisk: { label: 'At Risk', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  offTrack: { label: 'Off Track', color: 'bg-red-100 text-red-800 border-red-200' },
  onHold: { label: 'On Hold', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  mystery: { label: 'Mystery', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  complete: { label: 'Complete', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  unknown: { label: 'Unknown', color: 'bg-gray-100 text-gray-600 border-gray-300' }
} as const;

const HealthBadges = React.memo(({ healthBreakdown, projectDetails }: HealthBadgesProps) => {
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  const badges = Object.entries(healthBreakdown)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => {
      const config = healthConfig[key as keyof typeof healthConfig];
      const projects = projectDetails[key as keyof typeof projectDetails];
      
      return (
        <div key={key} className="relative inline-block">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color} cursor-help`}
            onMouseEnter={() => setHoveredBadge(key)}
            onMouseLeave={() => setHoveredBadge(null)}
          >
            {config.label}: {count}
          </span>
          
          {/* Tooltip */}
          {hoveredBadge === key && projects.length > 0 && (
            <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-xs">
              <div className="font-semibold mb-1">{config.label} Projects:</div>
              <div className="space-y-1">
                {projects.map((project, index) => (
                  <div key={index} className="truncate">
                    <span className="font-mono text-blue-300">{project.key}</span>
                    <span className="text-gray-300"> - </span>
                    <span className="text-gray-100">{project.summary}</span>
                  </div>
                ))}
              </div>
              {/* Arrow pointing down */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          )}
        </div>
      );
    });

  if (badges.length === 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-gray-100 text-gray-500 border-gray-300">
        No projects
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges}
    </div>
  );
});

HealthBadges.displayName = 'HealthBadges';

export default HealthBadges;
