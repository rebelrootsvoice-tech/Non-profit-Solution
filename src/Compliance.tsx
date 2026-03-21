import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Search, Filter, Trash2, CheckCircle, Clock, AlertCircle, FileText, Calculator } from 'lucide-react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { FileUpload } from './components/FileUpload';

interface ComplianceItem {
  id: string;
  title: string;
  description?: string;
  type: 'filing' | 'policy' | 'report' | 'other';
  dueDate: string;
  status: 'pending' | 'submitted' | 'approved' | 'overdue';
  assignedTo: string;
  documentUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
  status: 'pending' | 'reconciled';
}

function IRS990Automation() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'transactions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txData: Transaction[] = [];
      snapshot.forEach((doc) => {
        txData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(txData);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Calculate 990 fields
  const totalRevenue = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netAssets = totalRevenue - totalExpenses;

  // Contributions, Gifts, Grants (Part VIII, Line 1)
  const contributions = transactions.filter(t => t.type === 'income' && (t.category === 'donation' || t.category === 'grant')).reduce((sum, t) => sum + t.amount, 0);
  
  // Program Service Revenue (Part VIII, Line 2)
  const programRevenue = transactions.filter(t => t.type === 'income' && t.category === 'program').reduce((sum, t) => sum + t.amount, 0);

  // Functional Expenses (Part IX)
  // Grants and similar amounts paid (Line 1-3)
  const grantsPaid = transactions.filter(t => t.type === 'expense' && t.category === 'grant').reduce((sum, t) => sum + t.amount, 0);
  
  // Other expenses
  const otherExpenses = transactions.filter(t => t.type === 'expense' && t.category !== 'grant').reduce((sum, t) => sum + t.amount, 0);

  const handleExportCSV = () => {
    const data = [
      ['Form 990 Field', 'Description', 'Amount'],
      ['Part I, Line 12', 'Total Revenue', totalRevenue.toFixed(2)],
      ['Part I, Line 18', 'Total Expenses', totalExpenses.toFixed(2)],
      ['Part I, Line 22', 'Net Assets', netAssets.toFixed(2)],
      ['Part VIII, Line 1h', 'Contributions, Gifts, Grants', contributions.toFixed(2)],
      ['Part VIII, Line 2g', 'Program Service Revenue', programRevenue.toFixed(2)],
      ['Part IX, Line 3', 'Grants and similar amounts paid', grantsPaid.toFixed(2)],
      ['Part IX, Line 24', 'Other expenses', otherExpenses.toFixed(2)],
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + data.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `IRS_990_Summary_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-8 text-center text-stone-500">Loading financial data...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Calculator className="h-6 w-6 text-emerald-700" />
          </div>
          <div>
            <h4 className="text-lg font-medium text-stone-900">Form 990 Auto-Fill Summary</h4>
            <p className="text-sm text-stone-500">
              This data is automatically aggregated from your synced bank transactions and scanned receipts. 
              Use these figures to complete your annual IRS Form 990.
            </p>
          </div>
        </div>

        <div className="space-y-8 mt-8">
          {/* Part I: Summary */}
          <div>
            <h5 className="text-md font-semibold text-stone-800 border-b border-stone-200 pb-2 mb-4">Part I: Summary</h5>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-stone-500">Total Revenue (Line 12)</dt>
                <dd className="mt-1 text-2xl font-semibold text-emerald-600">${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-stone-500">Total Expenses (Line 18)</dt>
                <dd className="mt-1 text-2xl font-semibold text-stone-900">${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-stone-500">Net Assets (Line 22)</dt>
                <dd className={`mt-1 text-2xl font-semibold ${netAssets >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ${netAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Part VIII: Statement of Revenue */}
          <div>
            <h5 className="text-md font-semibold text-stone-800 border-b border-stone-200 pb-2 mb-4">Part VIII: Statement of Revenue</h5>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div className="flex justify-between border-b border-stone-100 py-2">
                <dt className="text-sm text-stone-600">Contributions, Gifts, Grants (Line 1h)</dt>
                <dd className="text-sm font-medium text-stone-900">${contributions.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
              </div>
              <div className="flex justify-between border-b border-stone-100 py-2">
                <dt className="text-sm text-stone-600">Program Service Revenue (Line 2g)</dt>
                <dd className="text-sm font-medium text-stone-900">${programRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
              </div>
            </dl>
          </div>

          {/* Part IX: Statement of Functional Expenses */}
          <div>
            <h5 className="text-md font-semibold text-stone-800 border-b border-stone-200 pb-2 mb-4">Part IX: Statement of Functional Expenses</h5>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div className="flex justify-between border-b border-stone-100 py-2">
                <dt className="text-sm text-stone-600">Grants and similar amounts paid (Line 3)</dt>
                <dd className="text-sm font-medium text-stone-900">${grantsPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
              </div>
              <div className="flex justify-between border-b border-stone-100 py-2">
                <dt className="text-sm text-stone-600">Other expenses (Line 24)</dt>
                <dd className="text-sm font-medium text-stone-900">${otherExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
              </div>
            </dl>
          </div>
          
          <div className="mt-6 flex justify-end">
             <button 
               onClick={handleExportCSV}
               className="inline-flex items-center rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
             >
               <FileText className="-ml-0.5 mr-1.5 h-5 w-5" />
               Export 990 Data (CSV)
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Compliance() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'requirements' | 'irs990'>('requirements');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'filing' | 'policy' | 'report' | 'other'>('filing');
  const [dueDate, setDueDate] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'compliance'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const complianceData: ComplianceItem[] = [];
      snapshot.forEach((doc) => {
        complianceData.push({ id: doc.id, ...doc.data() } as ComplianceItem);
      });
      // Sort by due date ascending
      complianceData.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setItems(complianceData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching compliance items:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newDocRef = doc(collection(db, 'compliance'));
      const newItem: ComplianceItem = {
        id: newDocRef.id,
        title,
        description: description || undefined,
        type,
        dueDate: new Date(dueDate).toISOString(),
        status: 'pending',
        assignedTo: user.uid, // Default to creator for now
        documentUrl: documentUrl || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(newDocRef, newItem);
      
      // Reset form
      setTitle('');
      setDescription('');
      setType('filing');
      setDueDate('');
      setDocumentUrl('');
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding compliance item:", error);
      alert("Failed to add compliance item. See console for details.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this compliance item?')) {
      try {
        await deleteDoc(doc(db, 'compliance', id));
      } catch (error) {
        console.error("Error deleting compliance item:", error);
        alert("Failed to delete compliance item.");
      }
    }
  };

  const handleStatusChange = async (id: string, newStatus: ComplianceItem['status']) => {
    try {
      await updateDoc(doc(db, 'compliance', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status.");
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'submitted': return <FileText className="h-5 w-5 text-blue-500" />;
      case 'overdue': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
      case 'submitted': return 'bg-blue-50 text-blue-700 ring-blue-600/20';
      case 'overdue': return 'bg-red-50 text-red-700 ring-red-600/20';
      default: return 'bg-amber-50 text-amber-700 ring-amber-600/20';
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'filing': return 'bg-indigo-50 text-indigo-700 ring-indigo-600/20';
      case 'policy': return 'bg-purple-50 text-purple-700 ring-purple-600/20';
      case 'report': return 'bg-sky-50 text-sky-700 ring-sky-600/20';
      default: return 'bg-stone-50 text-stone-700 ring-stone-600/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between border-b border-stone-200 pb-5">
        <div>
          <h3 className="text-2xl font-semibold leading-6 text-stone-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-stone-400" />
            Compliance & IRS 990
          </h3>
          <p className="mt-2 text-sm text-stone-500">
            Control tower for deadlines, filings, policy reviews, and automated IRS 990 reporting.
          </p>
        </div>
        <div className="mt-4 sm:ml-4 sm:mt-0">
          {(role === 'admin' || role === 'staff') && activeTab === 'requirements' && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="inline-flex items-center rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
            >
              <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
              Add Requirement
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('requirements')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'requirements'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
            }`}
          >
            Requirements Tracker
          </button>
          <button
            onClick={() => setActiveTab('irs990')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'irs990'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
            }`}
          >
            IRS 990 Automation
          </button>
        </nav>
      </div>

      {activeTab === 'irs990' ? (
        <IRS990Automation />
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="overflow-hidden rounded-xl bg-white px-4 py-5 shadow-sm border border-stone-200 sm:p-6">
          <dt className="truncate text-sm font-medium text-stone-500">Pending Items</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
            {items.filter(i => i.status === 'pending').length}
          </dd>
        </div>
        <div className="overflow-hidden rounded-xl bg-white px-4 py-5 shadow-sm border border-stone-200 sm:p-6">
          <dt className="truncate text-sm font-medium text-stone-500">Overdue</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-red-600">
            {items.filter(i => i.status === 'overdue').length}
          </dd>
        </div>
        <div className="overflow-hidden rounded-xl bg-white px-4 py-5 shadow-sm border border-stone-200 sm:p-6">
          <dt className="truncate text-sm font-medium text-stone-500">Submitted</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-blue-600">
            {items.filter(i => i.status === 'submitted').length}
          </dd>
        </div>
        <div className="overflow-hidden rounded-xl bg-white px-4 py-5 shadow-sm border border-stone-200 sm:p-6">
          <dt className="truncate text-sm font-medium text-stone-500">Approved</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-emerald-600">
            {items.filter(i => i.status === 'approved').length}
          </dd>
        </div>
      </div>

      {isAdding && (role === 'admin' || role === 'staff') && (
        <div className="rounded-xl bg-stone-50 p-6 border border-stone-200">
          <h4 className="text-lg font-medium text-stone-900 mb-4">Add New Requirement</h4>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="title" className="block text-sm font-medium leading-6 text-stone-900">Title</label>
                <input
                  type="text"
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:ring-2 focus:ring-inset focus:ring-stone-900 sm:text-sm sm:leading-6"
                  placeholder="e.g., Form 990 Filing"
                />
              </div>
              
              <div className="sm:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium leading-6 text-stone-900">Description (Optional)</label>
                <textarea
                  id="description"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:ring-2 focus:ring-inset focus:ring-stone-900 sm:text-sm sm:leading-6"
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium leading-6 text-stone-900">Type</label>
                <select
                  id="type"
                  required
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-stone-900 sm:text-sm sm:leading-6"
                >
                  <option value="filing">Filing</option>
                  <option value="policy">Policy Review</option>
                  <option value="report">Report</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium leading-6 text-stone-900">Due Date</label>
                <input
                  type="date"
                  id="dueDate"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-stone-900 sm:text-sm sm:leading-6"
                />
              </div>

              <div className="sm:col-span-2">
                <FileUpload 
                  folder="compliance" 
                  label="Document (Optional)" 
                  defaultUrl={documentUrl} 
                  onUploadComplete={setDocumentUrl} 
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800"
              >
                Save Requirement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters and List */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-4 border-b border-stone-200 sm:flex sm:items-center sm:justify-between gap-4">
          <div className="relative flex-grow max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-stone-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-0 py-1.5 pl-10 text-stone-900 ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:ring-2 focus:ring-inset focus:ring-stone-900 sm:text-sm sm:leading-6"
              placeholder="Search compliance items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="mt-4 sm:mt-0 flex items-center gap-2">
            <Filter className="h-5 w-5 text-stone-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-stone-900 ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-stone-900 sm:text-sm sm:leading-6"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-stone-500">Loading compliance items...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-stone-500">No compliance items found.</div>
        ) : (
          <ul role="list" className="divide-y divide-stone-200">
            {filteredItems.map((item) => (
              <li key={item.id} className="p-4 hover:bg-stone-50 transition-colors">
                <div className="flex items-center justify-between gap-x-6">
                  <div className="min-w-0 flex-auto">
                    <div className="flex items-center gap-x-3">
                      {getStatusIcon(item.status)}
                      <p className="text-sm font-semibold leading-6 text-stone-900">
                        {item.title}
                      </p>
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getTypeBadgeClass(item.type)}`}>
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </span>
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusBadgeClass(item.status)}`}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-xs leading-5 text-stone-500">
                      <p>
                        Due: <time dateTime={item.dueDate}>{new Date(item.dueDate).toLocaleDateString()}</time>
                      </p>
                      {item.description && (
                        <>
                          <span className="hidden sm:inline">&middot;</span>
                          <p className="truncate max-w-md">{item.description}</p>
                        </>
                      )}
                      {item.documentUrl && (
                        <>
                          <span className="hidden sm:inline">&middot;</span>
                          <a href={item.documentUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900 hover:underline">
                            View Document
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-x-4">
                    {(role === 'admin' || role === 'staff') && (
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value as any)}
                        className="rounded-md border-0 py-1.5 pl-3 pr-8 text-stone-900 ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-stone-900 sm:text-xs sm:leading-6"
                      >
                        <option value="pending">Pending</option>
                        <option value="submitted">Submitted</option>
                        <option value="approved">Approved</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    )}
                    {role === 'admin' && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-stone-400 hover:text-red-500 transition-colors"
                        title="Delete item"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      </>
      )}
    </div>
  );
}
