import type { Metadata } from 'next'
import { Mulish } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import { CycleTimeProvider } from '@/contexts/CycleTimeContext'

const mulish = Mulish({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Jira Dashboard',
  description: 'Monitor team workload, discovery cycle times, and project health',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={mulish.className}>
        <CycleTimeProvider>
          <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm border-b">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                  <div className="flex items-center">
                    <h1 className="text-xl font-semibold text-gray-900">
                      Jira Dashboard
                    </h1>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-500">Jira Dashboard v2.1</span>
                  </div>
                </div>
              </div>
            </header>
            
            <Navigation />

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </CycleTimeProvider>
      </body>
    </html>
  )
}