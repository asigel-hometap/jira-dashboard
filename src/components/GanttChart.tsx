import React, { useMemo, useState } from 'react';
import { format, parseISO, differenceInDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

interface GanttData {
  projectKey: string;
  projectName: string;
  assignee: string;
  discoveryStart: string;
  discoveryEnd: string;
  endDateLogic: string;
  calendarDays: number;
  activeDays: number;
  inactivePeriods?: Array<{start: string, end: string}>;
  isStillInDiscovery?: boolean;
}

interface GanttChartProps {
  data: GanttData[];
  height?: number;
}

const GanttChart: React.FC<GanttChartProps> = ({ data, height = 400 }) => {
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [hiddenLegendItems, setHiddenLegendItems] = useState<Set<string>>(new Set());
  const [showInactivePeriods, setShowInactivePeriods] = useState<boolean>(false);

  // Transform data for the chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return { projects: [], dateRange: { start: new Date(), end: new Date() } };
    }

    // Sort by discovery start date
    const sortedData = [...data].sort((a, b) => 
      new Date(a.discoveryStart).getTime() - new Date(b.discoveryStart).getTime()
    );

    // Calculate date range
    const allDates = sortedData.flatMap(project => [
      parseISO(project.discoveryStart),
      parseISO(project.discoveryEnd)
    ]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    // Extend range by 10% on each side for better visualization
    const range = maxDate.getTime() - minDate.getTime();
    const extendedStart = new Date(minDate.getTime() - range * 0.1);
    const extendedEnd = new Date(maxDate.getTime() + range * 0.1);

    // Filter out hidden legend items
    const filteredData = sortedData.filter(project => {
      const endDateLogic = project.endDateLogic;
      const isStillInDiscovery = project.isStillInDiscovery;
      
      // Check if this project type should be hidden
      if (isStillInDiscovery && hiddenLegendItems.has('Still in Discovery')) {
        return false;
      }
      if (!isStillInDiscovery && hiddenLegendItems.has(endDateLogic)) {
        return false;
      }
      
      return true;
    });

    return {
      projects: filteredData.map((project, index) => {
        const startDate = parseISO(project.discoveryStart);
        const endDate = parseISO(project.discoveryEnd);
        const duration = differenceInDays(endDate, startDate);
        const calendarDays = project.calendarDays;
        const activeDays = project.activeDays;
        const inactiveDays = calendarDays - activeDays;
        
        // Calculate inactive period segments using real data
        const inactivePeriods = [];
        if (showInactivePeriods && project.inactivePeriods && project.inactivePeriods.length > 0) {
          const totalDuration = endDate.getTime() - startDate.getTime();
          
          for (const period of project.inactivePeriods) {
            const periodStart = new Date(period.start);
            const periodEnd = new Date(period.end);
            
            // Only include periods that overlap with the project timeline
            if (periodEnd <= startDate || periodStart >= endDate) continue;
            
            // Calculate the overlap with the project timeline
            const overlapStart = new Date(Math.max(periodStart.getTime(), startDate.getTime()));
            const overlapEnd = new Date(Math.min(periodEnd.getTime(), endDate.getTime()));
            
            // Calculate percentages relative to the project bar
            const leftPercent = Math.max(0, ((overlapStart.getTime() - startDate.getTime()) / totalDuration) * 100);
            const widthPercent = Math.min(100 - leftPercent, ((overlapEnd.getTime() - overlapStart.getTime()) / totalDuration) * 100);
            
            // Ensure segments stay within bar boundaries
            const maxLeftPercent = 100 - widthPercent;
            const clampedLeftPercent = Math.min(leftPercent, maxLeftPercent);
            
            inactivePeriods.push({
              start: overlapStart,
              end: overlapEnd,
              leftPercent: clampedLeftPercent,
              widthPercent: Math.min(widthPercent, 100 - clampedLeftPercent)
            });
          }
        }
        
        return {
          ...project,
          index,
          startDate,
          endDate,
          duration,
          calendarDays,
          activeDays,
          inactiveDays,
          inactivePeriods
        };
      }),
      dateRange: { start: extendedStart, end: extendedEnd }
    };
  }, [data, hiddenLegendItems, showInactivePeriods]);

  // Get unique end date logic types for legend
  const endDateLogicTypes = useMemo(() => {
    const types = new Set(data.map(d => d.endDateLogic));
    return Array.from(types).sort();
  }, [data]);

  // Check if we have any projects still in discovery
  const hasStillInDiscovery = data.some(d => d.isStillInDiscovery);

  // Toggle legend item visibility
  const toggleLegendItem = (item: string) => {
    setHiddenLegendItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item)) {
        newSet.delete(item);
      } else {
        newSet.add(item);
      }
      return newSet;
    });
  };

  // Color mapping for end date logic
  const getEndDateLogicColor = (endDateLogic: string) => {
    const colors: { [key: string]: string } = {
      'Build Transition': '#10B981', // Green
      'Build': '#10B981', // Green
      'Beta': '#3B82F6', // Blue
      'Live': '#8B5CF6', // Purple
      'Won\'t Do': '#EF4444', // Red
      'Still in Discovery': '#366CED', // Blue
      'No Discovery': '#6B7280', // Gray
      'Direct to Build': '#EC4899', // Pink
    };
    return colors[endDateLogic] || '#6B7280';
  };

  // Calculate position and width for a project bar
  const getBarStyle = (project: any) => {
    const totalRange = chartData.dateRange.end.getTime() - chartData.dateRange.start.getTime();
    const leftPercent = ((project.startDate.getTime() - chartData.dateRange.start.getTime()) / totalRange) * 100;
    const widthPercent = ((project.endDate.getTime() - project.startDate.getTime()) / totalRange) * 100;
    
    return {
      left: `${leftPercent}%`,
      width: `${Math.max(widthPercent, 0.5)}%`, // Minimum 0.5% width for visibility
    };
  };

  // Generate date labels for the timeline - use monthly intervals for better readability
  const timelineDates = useMemo(() => {
    const start = chartData.dateRange.start;
    const end = chartData.dateRange.end;
    const range = end.getTime() - start.getTime();
    
    // Calculate appropriate interval based on range
    let intervalDays;
    if (range < 30 * 24 * 60 * 60 * 1000) { // Less than 30 days
      intervalDays = 7; // Weekly
    } else if (range < 90 * 24 * 60 * 60 * 1000) { // Less than 90 days
      intervalDays = 14; // Bi-weekly
    } else {
      intervalDays = 30; // Monthly
    }
    
    const dates = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + intervalDays);
    }
    
    return dates;
  }, [chartData.dateRange]);

  if (chartData.projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No discovery cycle data available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Legend (click to toggle)</h4>
        <div className="flex flex-wrap gap-4 text-sm">
          {/* Inactive Periods Toggle */}
          <div 
            className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowInactivePeriods(!showInactivePeriods)}
          >
            <div className={`w-3 h-3 rounded ${showInactivePeriods ? 'bg-gray-500' : 'bg-gray-200 border border-gray-400'}`} />
            <span className="text-gray-600">
              Inactive Periods
            </span>
          </div>
          {endDateLogicTypes.map((type) => {
            const isHidden = hiddenLegendItems.has(type);
            return (
              <div 
                key={type} 
                className={`flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity ${
                  isHidden ? 'opacity-50' : ''
                }`}
                onClick={() => toggleLegendItem(type)}
              >
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: getEndDateLogicColor(type) }}
                />
                <span className={`text-gray-600 ${isHidden ? 'line-through' : ''}`}>
                  {type}
                </span>
              </div>
            );
          })}
          {hasStillInDiscovery && (
            <div 
              className={`flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity ${
                hiddenLegendItems.has('Still in Discovery') ? 'opacity-50' : ''
              }`}
              onClick={() => toggleLegendItem('Still in Discovery')}
            >
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className={`text-gray-600 ${
                hiddenLegendItems.has('Still in Discovery') ? 'line-through' : ''
              }`}>
                Still in Discovery
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chart Container */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Timeline Header */}
        <div className="bg-gray-50 px-4 py-4 border-b border-gray-200">
          <div className="flex">
            <div className="w-48 flex-shrink-0"></div> {/* Space for project labels */}
            <div className="flex-1 relative h-8">
              {timelineDates.map((date, index) => (
                <div
                  key={index}
                  className="absolute text-xs text-gray-600 whitespace-nowrap leading-tight"
                  style={{
                    left: `${(index / Math.max(timelineDates.length - 1, 1)) * 100}%`,
                    transform: 'translateX(-50%)',
                    top: '0.25rem'
                  }}
                >
                  {format(date, 'MMM dd')}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gantt Chart */}
        <div className="overflow-x-auto" style={{ height: height }}>
          <div className="min-w-full">
            {chartData.projects.map((project, index) => (
              <div
                key={project.projectKey}
                className="flex items-center py-2 border-b border-gray-100 hover:bg-gray-50"
                onMouseEnter={() => setHoveredProject(project.projectKey)}
                onMouseLeave={() => setHoveredProject(null)}
              >
                {/* Project Label */}
                <div className="w-48 flex-shrink-0 px-2">
                  <div className="text-sm font-medium text-gray-900 truncate" title={project.projectKey}>
                    {project.projectKey}
                  </div>
                  <div className="text-xs text-gray-600 truncate" title={project.projectName}>
                    {project.projectName}
                  </div>
                </div>

                {/* Timeline Bar */}
                <div className="flex-1 relative h-8 bg-gray-100">
                  {/* Discovery Cycle Bar */}
                  <div
                    className={`absolute top-1 h-6 rounded-sm flex items-center justify-end pr-1 ${
                      project.isStillInDiscovery 
                        ? 'bg-gradient-to-r from-blue-200 to-blue-300 border border-blue-400' 
                        : 'bg-blue-200 border border-blue-300'
                    }`}
                    style={getBarStyle(project)}
                  >
                    {/* Inactive Period Segments */}
                    {showInactivePeriods && project.inactivePeriods && project.inactivePeriods.length > 0 && (
                      <>
                        {project.inactivePeriods.map((period, periodIndex) => (
                          <div
                            key={periodIndex}
                            className="absolute top-0 h-6 bg-gray-500 opacity-60 rounded-sm"
                            style={{
                              left: `${period.leftPercent}%`,
                              width: `${period.widthPercent}%`
                            }}
                            title={`Inactive period: ${format(period.start, 'MMM dd')} - ${format(period.end, 'MMM dd')}`}
                          />
                        ))}
                      </>
                    )}
                    
                    {/* End Date Logic Marker */}
                    {!project.isStillInDiscovery && (
                      <div
                        className="w-2 h-2 rounded-full border border-white relative z-10"
                        style={{ backgroundColor: getEndDateLogicColor(project.endDateLogic) }}
                        title={`End: ${format(project.endDate, 'MMM dd, yyyy')} (${project.endDateLogic})`}
                      />
                    )}
                    {/* Still in Discovery Indicator */}
                    {project.isStillInDiscovery && (
                      <div
                        className="w-2 h-2 rounded-full border border-white bg-yellow-400 relative z-10"
                        title={`Still in Discovery (as of ${format(project.endDate, 'MMM dd, yyyy')})`}
                      />
                    )}
                  </div>

                  {/* Hover Tooltip */}
                  {hoveredProject === project.projectKey && (
                    <div className="absolute z-10 bg-white p-3 border border-gray-200 rounded-lg shadow-lg text-sm min-w-64">
                      <div className="font-semibold text-gray-900 mb-2">{project.projectName}</div>
                      <div className="text-gray-600 space-y-1">
                        <div><strong>Key:</strong> <a href={`https://hometap.atlassian.net/browse/${project.projectKey}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">{project.projectKey}</a></div>
                        <div><strong>Assignee:</strong> {project.assignee}</div>
                        <div><strong>Discovery Start:</strong> {format(project.startDate, 'MMM dd, yyyy')}</div>
                        <div><strong>Discovery End:</strong> {format(project.endDate, 'MMM dd, yyyy')} - {project.endDateLogic}</div>
                        <div><strong>Calendar Days:</strong> {project.calendarDays}</div>
                        <div><strong>Active Days:</strong> {project.activeDays}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttChart;
