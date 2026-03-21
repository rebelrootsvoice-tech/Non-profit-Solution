import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { TrendingUp, DollarSign, Users, Clock, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

interface Donation {
  id: string;
  amount: number;
  date: string;
  donationType: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
}

interface VolunteerLog {
  id: string;
  hours: number;
  date: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function Reports() {
  const { role } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [volunteerLogs, setVolunteerLogs] = useState<VolunteerLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role === 'volunteer') {
      setLoading(false);
      return;
    }

    const donationsUnsub = onSnapshot(query(collection(db, 'donations'), orderBy('date', 'asc')), (snapshot) => {
      setDonations(snapshot.docs.map(doc => doc.data() as Donation));
    });

    const transactionsUnsub = onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'asc')), (snapshot) => {
      setTransactions(snapshot.docs.map(doc => doc.data() as Transaction));
    });

    const volunteerUnsub = onSnapshot(query(collection(db, 'volunteerHours'), orderBy('date', 'asc')), (snapshot) => {
      setVolunteerLogs(snapshot.docs.map(doc => doc.data() as VolunteerLog));
    });

    setLoading(false);

    return () => {
      donationsUnsub();
      transactionsUnsub();
      volunteerUnsub();
    };
  }, [role]);

  if (role === 'volunteer') {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-stone-900">Access Denied</h2>
        <p className="mt-2 text-stone-500">You do not have permission to view financial reports.</p>
      </div>
    );
  }

  // Process data for charts
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      month: format(date, 'MMM'),
      fullName: format(date, 'MMMM yyyy'),
      start: startOfMonth(date),
      end: endOfMonth(date),
      donations: 0,
      expenses: 0,
      hours: 0
    };
  }).reverse();

  last6Months.forEach(monthData => {
    // Donations
    donations.forEach(d => {
      const dDate = parseISO(d.date);
      if (isWithinInterval(dDate, { start: monthData.start, end: monthData.end })) {
        monthData.donations += d.amount;
      }
    });

    // Expenses
    transactions.forEach(t => {
      const tDate = parseISO(t.date);
      if (t.type === 'expense' && isWithinInterval(tDate, { start: monthData.start, end: monthData.end })) {
        monthData.expenses += t.amount;
      }
    });

    // Volunteer Hours
    volunteerLogs.forEach(v => {
      const vDate = parseISO(v.date);
      if (isWithinInterval(vDate, { start: monthData.start, end: monthData.end })) {
        monthData.hours += v.hours;
      }
    });
  });

  // Category Breakdown (Pie Chart)
  const expenseCategories = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const pieData = Object.entries(expenseCategories).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));

  if (loading) return <div className="p-8 text-center text-stone-500">Loading reports...</div>;

  return (
    <div className="space-y-8">
      <div className="border-b border-stone-200 pb-5">
        <h3 className="text-2xl font-semibold leading-6 text-stone-900 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-stone-400" />
          Impact & Financial Reports
        </h3>
        <p className="mt-2 text-sm text-stone-500">
          Visualizing your organization's growth, spending, and volunteer engagement.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Donation Trends */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-medium text-stone-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Donation Trends (6 Months)
            </h4>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last6Months}>
                <defs>
                  <linearGradient id="colorDonations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#78716c', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#78716c', fontSize: 12}} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e7e5e4', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="donations" name="Donations" stroke="#10b981" fillOpacity={1} fill="url(#colorDonations)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-medium text-stone-900 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-indigo-500" />
              Expense Breakdown by Category
            </h4>
          </div>
          <div className="h-80 w-full flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `$${value.toLocaleString()}`}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e7e5e4' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-stone-500">No expense data available.</p>
            )}
          </div>
        </div>

        {/* Volunteer Engagement */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-stone-200 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-medium text-stone-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Volunteer Hours Logged
            </h4>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last6Months}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#78716c', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#78716c', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f5f5f4'}}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e7e5e4' }}
                />
                <Bar dataKey="hours" name="Hours Logged" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white shadow-sm ring-1 ring-stone-200 sm:rounded-xl overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-stone-200">
          <h3 className="text-base font-semibold leading-6 text-stone-900">Monthly Performance Summary</h3>
        </div>
        <table className="min-w-full divide-y divide-stone-200">
          <thead className="bg-stone-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-stone-900 sm:pl-6">Month</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-stone-900">Total Donations</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-stone-900">Total Expenses</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-stone-900">Net Flow</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-stone-900">Volunteer Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 bg-white">
            {last6Months.map((month) => (
              <tr key={month.month}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-stone-900 sm:pl-6">{month.fullName}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-emerald-600 font-medium">${month.donations.toLocaleString()}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-stone-900">${month.expenses.toLocaleString()}</td>
                <td className={`whitespace-nowrap px-3 py-4 text-sm text-right font-medium ${month.donations - month.expenses >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ${(month.donations - month.expenses).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-amber-600 font-medium">{month.hours} hrs</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
