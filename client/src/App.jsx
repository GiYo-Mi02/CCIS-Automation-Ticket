import { NavLink, Route, Routes } from 'react-router-dom';
import { CalendarDaysIcon, ChartBarIcon, QrCodeIcon } from '@heroicons/react/24/outline';
import DashboardPage from './pages/Dashboard.jsx';
import EventsPage from './pages/Events.jsx';
import ScannerPage from './pages/Scanner.jsx';

const links = [
  { to: '/', label: 'Dashboard', icon: ChartBarIcon },
  { to: '/events', label: 'Manage Events', icon: CalendarDaysIcon },
  { to: '/scanner', label: 'Scanner', icon: QrCodeIcon }
];

function App() {
  return (
    <div className="flex h-full">
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white p-6 md:flex">
        <h1 className="mb-10 text-xl font-semibold text-brand">CCIS Admin Console</h1>
        <nav className="space-y-2">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:hidden">
          <span className="text-lg font-semibold text-brand">CCIS Admin</span>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/scanner" element={<ScannerPage />} />
            <Route path="*" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
