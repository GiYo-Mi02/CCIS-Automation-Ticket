import { NavLink, Route, Routes } from 'react-router-dom';
import {
  CalendarDaysIcon,
  ChartBarIcon,
  QrCodeIcon,
  WrenchScrewdriverIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';
import DashboardPage from './pages/Dashboard.jsx';
import EventsPage from './pages/Events.jsx';
import ScannerPage from './pages/Scanner.jsx';
import OperationsPage from './pages/Operations.jsx';

const links = [
  { to: '/', label: 'Dashboard', icon: ChartBarIcon },
  { to: '/events', label: 'Manage Events', icon: CalendarDaysIcon },
  { to: '/operations', label: 'Operations', icon: WrenchScrewdriverIcon },
  { to: '/scanner', label: 'Scanner', icon: QrCodeIcon }
];

function App() {
  return (
    <div className="flex min-h-full flex-col bg-transparent text-slate-100 md:flex-row">
      <aside className="hidden w-72 flex-col gap-8 px-6 py-8 md:flex">
        <div className="glass-panel flex flex-col gap-10 px-6 py-8">
          <div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-slate-200/80">
              Control Center
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white drop-shadow-[0_8px_25px_rgba(56,189,248,0.28)]">
              CCIS Admin Console
            </h1>
          </div>
          <nav className="space-y-2">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500/90 to-indigo-500/90 text-white shadow-lg shadow-sky-900/40'
                    : 'text-slate-200/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
          </nav>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300/80 backdrop-blur">
            <p className="font-semibold uppercase tracking-[0.3em] text-slate-200/80">Tip</p>
            <p className="mt-2 leading-relaxed text-slate-300">
              Monitor seat availability and send announcements faster by keeping the Operations view pinned in a
              secondary tab.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/10 bg-slate-900/60 px-4 py-4 shadow-lg shadow-slate-950/40 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Bars3Icon className="h-5 w-5 text-slate-300" />
            <span className="text-lg font-semibold text-white">CCIS Admin</span>
          </div>
        </header>
        <main className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-10">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/scanner" element={<ScannerPage />} />
            <Route path="*" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
