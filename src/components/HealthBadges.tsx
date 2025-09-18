import React from 'react';

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
}

const healthConfig = {
  onTrack: { label: 'On Track', color: 'bg-green-100 text-green-800 border-green-200' },
  atRisk: { label: 'At Risk', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  offTrack: { label: 'Off Track', color: 'bg-red-100 text-red-800 border-red-200' },
  onHold: { label: 'On Hold', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  mystery: { label: 'Mystery', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  complete: { label: 'Complete', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  unknown: { label: 'Unknown', color: 'bg-gray-100 text-gray-600 border-gray-300' }
} as const;

const HealthBadges = React.memo(({ healthBreakdown }: HealthBadgesProps) => {
  const badges = Object.entries(healthBreakdown)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => {
      const config = healthConfig[key as keyof typeof healthConfig];
      return (
        <span
          key={key}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}
        >
          {config.label}: {count}
        </span>
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
