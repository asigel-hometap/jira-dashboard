'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const Navigation = () => {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Team Workload' },
    { href: '/projects-at-risk', label: 'Projects At Risk' },
    { href: '/trends', label: 'Trends Over Time' },
    { href: '/cycle-time', label: 'Cycle Time Analysis' },
    { href: '/cycle-time-details', label: 'Cycle Time Details' },
  ];

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
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
};

export default Navigation;
