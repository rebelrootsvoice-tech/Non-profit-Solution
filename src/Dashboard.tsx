import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Users, CheckSquare, FileText, DollarSign, ShieldCheck, Clock } from 'lucide-react';
import { collection, query, onSnapshot, where, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

interface Donation {
  id: string;
  donorName?: string;
  amount: number;
  donationType?: 'monetary' | 'in-kind';
  itemDescription?: string;
  date: string;
  source: string;
}

export function Dashboard() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState({
    donors: 0,
    tasks: 0,
    compliance: 0,
    unreconciled: 0,
    volunteerHours: 0
  });
  const [recentDonations, setRecentDonations] = useState<Donation[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // Listen to Contacts (Donors)
    let contactsUnsub = () => {};
    let volunteerUnsub = () => {};
    let txUnsub = () => {};
    let complianceUnsub = () => {};
    let donationsUnsub = () => {};
    let allDonationsUnsub = () => {};

    if (role === 'admin' || role === 'staff') {
      contactsUnsub = onSnapshot(query(collection(db, 'contacts'), where('type', '==', 'donor')), (snapshot) => {
        setStats(s => ({ ...s, donors: snapshot.size }));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'contacts');
      });

      volunteerUnsub = onSnapshot(query(collection(db, 'contacts'), where('type', '==', 'volunteer')), (snapshot) => {
        const totalHours = snapshot.docs.reduce((acc, doc) => acc + (doc.data().hoursLogged || 0), 0);
        setStats(s => ({ ...s, volunteerHours: totalHours }));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'contacts');
      });

      txUnsub = onSnapshot(query(collection(db, 'transactions'), where('status', '==', 'pending')), (snapshot) => {
        setStats(s => ({ ...s, unreconciled: snapshot.size }));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
      });

      donationsUnsub = onSnapshot(query(collection(db, 'donations'), orderBy('createdAt', 'desc'), limit(5)), (snapshot) => {
        setRecentDonations(snapshot.docs.map(doc => doc.data() as Donation));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'donations');
      });

      // Fetch data for the trend chart
      allDonationsUnsub = onSnapshot(query(collection(db, 'donations'), orderBy('date', 'asc')), (snapshot) => {
        const docs = snapshot.docs.map(doc => doc.data() as Donation);
        
        const last6Months = Array.from({ length: 6 }, (_, i) => {
          const date = subMonths(new Date(), i);
          return {
            month: format(date, 'MMM'),
            start: startOfMonth(date),
            end: endOfMonth(date),
            amount: 0
          };
        }).reverse();

        last6Months.forEach(m => {
          docs.forEach(d => {
            const dDate = parseISO(d.date);
            if (isWithinInterval(dDate, { start: m.start, end: m.end })) {
              m.amount += d.amount;
            }
          });
        });

        setChartData(last6Months);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'donations');
      });
    }

    // Listen to Pending Tasks
    const tasksUnsub = onSnapshot(query(collection(db, 'tasks'), where('status', '!=', 'done')), (snapshot) => {
      setStats(s => ({ ...s, tasks: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'tasks');
    });

    // Listen to Compliance Alerts
    complianceUnsub = onSnapshot(query(collection(db, 'compliance'), where('status', 'in', ['pending', 'overdue'])), (snapshot) => {
      setStats(s => ({ ...s, compliance: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'compliance');
    });

    return () => {
      contactsUnsub();
      volunteerUnsub();
      tasksUnsub();
      txUnsub();
      complianceUnsub();
      donationsUnsub();
      allDonationsUnsub();
    };
  }, [user, role]);

  const statCards = [
    { name: 'Active Donors', stat: stats.donors.toString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { name: 'Volunteer Hours', stat: stats.volunteerHours.toString(), icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { name: 'Pending Tasks', stat: stats.tasks.toString(), icon: CheckSquare, color: 'text-amber-600', bg: 'bg-amber-100' },
    { name: 'Compliance Alerts', stat: stats.compliance.toString(), icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-100' },
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
        {statCards.map((item) => (
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Donation Trend Chart */}
        <div className="lg:col-span-2 rounded-xl bg-white shadow-sm border border-stone-200 p-6">
          <h3 className="text-base font-semibold leading-6 text-stone-900 mb-6">Donation Trends</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#78716c', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#78716c', fontSize: 12}} hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e7e5e4' }}
                  formatter={(value: number) => [`$${value}`, 'Donations']}
                />
                <Area type="monotone" dataKey="amount" stroke="#10b981" fillOpacity={1} fill="url(#colorAmt)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl bg-white shadow-sm border border-stone-200">
          <div className="p-6">
            <h3 className="text-base font-semibold leading-6 text-stone-900">Recent Donations</h3>
            <div className="mt-6 flow-root">
              <ul role="list" className="-my-5 divide-y divide-stone-200">
                {recentDonations.length === 0 ? (
                  <li className="py-4 text-sm text-stone-500">No recent donations found.</li>
                ) : (
                  recentDonations.map((donation) => (
                    <li key={donation.id} className="py-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <DollarSign className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-stone-900">
                            {donation.donationType === 'in-kind' ? `In-Kind: ${donation.itemDescription}` : `Monetary Donation`}
                          </p>
                          <p className="truncate text-sm text-stone-500">
                            {donation.donationType === 'in-kind' ? `Est. Value: $${donation.amount}` : `$${donation.amount}`} from {donation.donorName || 'Unknown Donor'}
                          </p>
                        </div>
                        <div>
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            {new Date(donation.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-1">
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
