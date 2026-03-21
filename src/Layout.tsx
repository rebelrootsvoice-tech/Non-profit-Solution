import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  CheckSquare, 
  FileText, 
  DollarSign, 
  LogOut,
  ShieldCheck,
  BarChart3
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Layout() {
  const { user, role, logout } = useAuth();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/donors', icon: Users, label: 'Donors & Grants' },
    { to: '/bookkeeping', icon: DollarSign, label: 'Bookkeeping' },
    { to: '/compliance', icon: ShieldCheck, label: 'Compliance' },
    { to: '/board', icon: FileText, label: 'Board Governance' },
    { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
    { to: '/reports', icon: BarChart3, label: 'Reports' },
  ];

  return (
    <div className="flex h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col">
        <div className="p-6 border-b border-stone-200">
          <h1 className="text-xl font-semibold tracking-tight text-emerald-700">Non-profit Solutions</h1>
          <p className="text-xs text-stone-500 mt-1">Role: {role}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => twMerge(
                clsx(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive 
                    ? 'bg-emerald-50 text-emerald-700' 
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                )
              )}
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-stone-200">
          <div className="flex items-center mb-4">
            <img 
              src={user?.photoURL || 'https://picsum.photos/seed/user/40/40'} 
              alt="User" 
              className="h-8 w-8 rounded-full bg-stone-200"
              referrerPolicy="no-referrer"
            />
            <div className="ml-3 truncate">
              <p className="text-sm font-medium text-stone-900 truncate">{user?.displayName}</p>
              <p className="text-xs text-stone-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center px-3 py-2 text-sm font-medium text-stone-600 rounded-md hover:bg-stone-100 hover:text-stone-900 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
