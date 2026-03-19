import { useAuth } from './AuthContext';
import { Users, CheckSquare, FileText, DollarSign, ShieldCheck } from 'lucide-react';

export function Dashboard() {
  const { user } = useAuth();

  const stats = [
    { name: 'Active Donors', stat: '1,240', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { name: 'Pending Tasks', stat: '12', icon: CheckSquare, color: 'text-amber-600', bg: 'bg-amber-100' },
    { name: 'Compliance Alerts', stat: '2', icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-100' },
    { name: 'Unreconciled Txns', stat: '45', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-stone-200 pb-5">
        <h3 className="text-2xl font-semibold leading-6 text-stone-900">
          Welcome back, {user?.displayName?.split(' ')[0]}
        </h3>
        <p className="mt-2 max-w-4xl text-sm text-stone-500">
          Here is your organization's overview for today.
        </p>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.name}
            className="relative overflow-hidden rounded-xl bg-white px-4 pb-12 pt-5 shadow-sm border border-stone-200 sm:px-6 sm:pt-6"
          >
            <dt>
              <div className={`absolute rounded-md p-3 ${item.bg}`}>
                <item.icon className={`h-6 w-6 ${item.color}`} aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-stone-500">{item.name}</p>
            </dt>
            <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p className="text-2xl font-semibold text-stone-900">{item.stat}</p>
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="rounded-xl bg-white shadow-sm border border-stone-200">
          <div className="p-6">
            <h3 className="text-base font-semibold leading-6 text-stone-900">Recent Activity</h3>
            <div className="mt-6 flow-root">
              <ul role="list" className="-my-5 divide-y divide-stone-200">
                <li className="py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <DollarSign className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">New donation via Zeffy</p>
                      <p className="truncate text-sm text-stone-500">$500 from Sarah Jenkins</p>
                    </div>
                    <div>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        2h ago
                      </span>
                    </div>
                  </div>
                </li>
                <li className="py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <ShieldCheck className="h-6 w-6 text-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">Compliance Deadline Approaching</p>
                      <p className="truncate text-sm text-stone-500">Form 990 due in 30 days</p>
                    </div>
                    <div>
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        1d ago
                      </span>
                    </div>
                  </div>
                </li>
                <li className="py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <FileText className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">Board Minutes Uploaded</p>
                      <p className="truncate text-sm text-stone-500">Q3 Board Meeting Minutes draft</p>
                    </div>
                    <div>
                      <span className="inline-flex items-center rounded-full bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600 ring-1 ring-inset ring-stone-500/10">
                        2d ago
                      </span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div className="rounded-xl bg-white shadow-sm border border-stone-200">
          <div className="p-6">
            <h3 className="text-base font-semibold leading-6 text-stone-900">My Tasks</h3>
            <div className="mt-6 flow-root">
              <ul role="list" className="-my-5 divide-y divide-stone-200">
                <li className="py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">Send thank you letter to Sarah Jenkins</p>
                      <p className="truncate text-sm text-stone-500">Donor Management</p>
                    </div>
                    <div>
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                        Due Today
                      </span>
                    </div>
                  </div>
                </li>
                <li className="py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">Review monthly bank reconciliation</p>
                      <p className="truncate text-sm text-stone-500">Bookkeeping</p>
                    </div>
                    <div>
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        Due Tomorrow
                      </span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
