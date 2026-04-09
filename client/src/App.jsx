import { NavLink, Route, Routes } from 'react-router-dom';
import {
  CalendarDaysIcon,
  ChartBarIcon,
  QrCodeIcon,
  WrenchScrewdriverIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import DashboardPage from './pages/Dashboard.jsx';
import EventsPage from './pages/Events.jsx';
import ScannerPage from './pages/Scanner.jsx';
import OperationsPage from './pages/Operations.jsx';

const links = [
  { to: '/', label: 'Dashboard', icon: ChartBarIcon },
  { to: '/events', label: 'Events', icon: CalendarDaysIcon },
  { to: '/operations', label: 'Operations', icon: WrenchScrewdriverIcon },
  { to: '/scanner', label: 'Scanner', icon: QrCodeIcon }
];

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const SidebarContent = ({ isMobile }) => (
    <div className="flex flex-col flex-1 px-6 py-8 h-full">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold tracking-wider text-gray-600 uppercase">
            Control Center
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">
            CCIS Admin
          </h1>
        </div>
        {isMobile && (
          <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-gray-900 md:hidden p-1">
            <XMarkIcon className="h-6 w-6" />
          </button>
        )}
      </div>
      <nav className="space-y-1 flex-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => isMobile && setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs mt-auto">
        <p className="font-semibold text-gray-900 mb-1">Tip</p>
        <p className="text-gray-500">
          Keep Operations and Scanner open in separate tabs during check-in for maximum efficiency.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600 hover:text-gray-900 transition-colors p-1 -ml-1">
            <Bars3Icon className="h-6 w-6" />
          </button>
          <span className="text-lg font-semibold text-gray-900">CCIS Admin</span>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-gray-200">
        <SidebarContent isMobile={false} />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="relative flex w-72 max-w-[80%] flex-col bg-white h-full shadow-2xl transition-transform">
             <SidebarContent isMobile={true} />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:pl-64 min-h-screen pb-16 md:pb-0">
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-10 md:py-10">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/scanner" element={<ScannerPage />} />
            <Route path="*" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 z-40">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            <Icon className="h-6 w-6" />
            <span className="text-[10px] sm:text-xs font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default App;
