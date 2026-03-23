import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { Plus, Search, DollarSign, ArrowUpRight, ArrowDownRight, CheckCircle2, Circle, FileText, Trash2, Camera, RefreshCw, AlertTriangle, Paperclip, ChevronDown, Sparkles } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { FileUpload } from './components/FileUpload';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: 'donation' | 'grant' | 'operational' | 'program' | 'other' | 'uncategorized';
  status: 'pending' | 'reconciled';
  receiptUrl?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const autoCategorize = (description: string, type: 'income' | 'expense'): Transaction['category'] => {
  const desc = description.toLowerCase();
  if (type === 'income') {
    if (desc.includes('donation') || desc.includes('stripe') || desc.includes('paypal') || desc.includes('zeffy') || desc.includes('gift')) return 'donation';
    if (desc.includes('grant') || desc.includes('foundation')) return 'grant';
    if (desc.includes('program') || desc.includes('service') || desc.includes('ticket')) return 'program';
  } else {
    if (desc.includes('office') || desc.includes('software') || desc.includes('rent') || desc.includes('utility') || desc.includes('internet') || desc.includes('subscription')) return 'operational';
    if (desc.includes('program') || desc.includes('event') || desc.includes('supplies')) return 'program';
  }
  return 'uncategorized';
};

export function Bookkeeping() {
  const { user, role } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scannedData, setScannedData] = useState<Partial<Transaction> | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isMagicScanning, setIsMagicScanning] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'volunteer') {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'transactions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txData: Transaction[] = [];
      snapshot.forEach((doc) => {
        txData.push(doc.data() as Transaction);
      });
      // Sort by date descending
      txData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(txData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
      setLoading(false);
    });

    return unsubscribe;
  }, [role]);

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: file.type,
                },
              },
              {
                text: 'Extract the transaction details from this receipt. Return a JSON object with: amount (number), date (YYYY-MM-DD), description (string, vendor name), type (always "expense"), and category (one of: "donation", "grant", "operational", "program", "other").',
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                date: { type: Type.STRING },
                description: { type: Type.STRING },
                type: { type: Type.STRING },
                category: { type: Type.STRING },
              },
              required: ['amount', 'date', 'description', 'type', 'category'],
            },
          },
        });

        const data = JSON.parse(response.text);
        
        setScannedData({
          amount: data.amount,
          date: data.date,
          description: data.description,
          type: data.type as 'income' | 'expense',
          category: data.category as Transaction['category']
        });
        setShowAddModal(true);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error scanning receipt:", err);
      setError("Failed to scan receipt.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSyncBank = async () => {
    setIsSyncing(true);
    // Simulate API call to Plaid/Bank
    setTimeout(async () => {
      try {
        const mockTransactions = [
          {
            date: new Date().toISOString().split('T')[0],
            description: 'Stripe Transfer',
            amount: 1250.00,
            type: 'income',
            category: autoCategorize('Stripe Transfer', 'income'),
            status: 'pending'
          },
          {
            date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
            description: 'Unknown Vendor XYZ',
            amount: 145.20,
            type: 'expense',
            category: autoCategorize('Unknown Vendor XYZ', 'expense'),
            status: 'pending'
          }
        ];

        for (const tx of mockTransactions) {
          try {
            const newDocRef = doc(collection(db, 'transactions'));
            await setDoc(newDocRef, {
              id: newDocRef.id,
              ...tx,
              receiptUrl: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: user?.uid || 'system'
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'transactions');
          }
        }
        setSuccess("Bank sync complete! 2 new transactions imported.");
        setTimeout(() => setSuccess(null), 5000);
      } catch (err) {
        console.error("Bank sync error:", err);
        setError("Failed to sync bank transactions.");
        setTimeout(() => setError(null), 5000);
      } finally {
        setIsSyncing(false);
      }
    }, 2000);
  };

  const handleMagicScan = async () => {
    if (!selectedFile) return;

    setIsMagicScanning(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: selectedFile.type,
                },
              },
              {
                text: 'Extract the transaction details from this receipt. Return a JSON object with: amount (number), date (YYYY-MM-DD), description (string, vendor name), type (always "expense"), and category (one of: "donation", "grant", "operational", "program", "other").',
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                date: { type: Type.STRING },
                description: { type: Type.STRING },
                type: { type: Type.STRING },
                category: { type: Type.STRING },
              },
              required: ['amount', 'date', 'description', 'type', 'category'],
            },
          },
        });

        const data = JSON.parse(response.text);
        
        setScannedData({
          amount: data.amount,
          date: data.date,
          description: data.description,
          type: data.type as 'income' | 'expense',
          category: data.category as Transaction['category']
        });
      };
      reader.readAsDataURL(selectedFile);
    } catch (err) {
      console.error("Error scanning receipt:", err);
      setError("Failed to scan receipt.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsMagicScanning(false);
    }
  };
  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const type = formData.get('type') as 'income' | 'expense';
    const description = formData.get('description') as string || '';
    let category = formData.get('category') as Transaction['category'] | 'auto';
    
    if (category === 'auto') {
      category = autoCategorize(description, type);
    }

    try {
      const newDocRef = doc(collection(db, 'transactions'));
      await setDoc(newDocRef, {
        id: newDocRef.id,
        date: formData.get('date') || new Date().toISOString().split('T')[0],
        description,
        amount: parseFloat(formData.get('amount') as string) || 0,
        type,
        category,
        status: 'pending',
        receiptUrl: receiptUrl || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.uid || ''
      });
      setShowAddModal(false);
      setScannedData(null);
      setReceiptUrl('');
      setSuccess("Transaction added successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
    }
  };

  const handleUpdateCategory = async (id: string, newCategory: Transaction['category']) => {
    try {
      const txRef = doc(db, 'transactions', id);
      await updateDoc(txRef, {
        category: newCategory,
        updatedAt: new Date().toISOString()
      });
      setSuccess("Category updated.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${id}`);
    }
  };

  const toggleStatus = async (tx: Transaction) => {
    try {
      const txRef = doc(db, 'transactions', tx.id);
      await updateDoc(txRef, {
        status: tx.status === 'pending' ? 'reconciled' : 'pending',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${tx.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      setSuccess("Transaction deleted.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
    }
  };

  if (role === 'volunteer') {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-stone-900">Access Denied</h2>
        <p className="mt-2 text-stone-500">You do not have permission to view bookkeeping records.</p>
      </div>
    );
  }

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || tx.type === filterType;
    return matchesSearch && matchesType;
  });

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netIncome = totalIncome - totalExpense;
  const pendingCount = transactions.filter(t => t.status === 'pending').length;
  const uncategorizedCount = transactions.filter(t => t.category === 'uncategorized').length;

  return (
    <div className="space-y-6">
      {uncategorizedCount > 0 && (
        <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">Manual Categorization Needed</h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>
                  You have {uncategorizedCount} transaction{uncategorizedCount !== 1 ? 's' : ''} that could not be automatically categorized. Please review and categorize them manually below.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sm:flex sm:items-center sm:justify-between border-b border-stone-200 pb-5">
        <div>
          <h3 className="text-2xl font-semibold leading-6 text-stone-900">Bookkeeping</h3>
          <p className="mt-2 text-sm text-stone-500">
            Track income, expenses, and reconcile accounts.
          </p>
        </div>
        <div className="mt-4 sm:ml-4 sm:mt-0 flex flex-wrap gap-3">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleScanReceipt}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-50"
          >
            <Camera className="-ml-0.5 mr-1.5 h-5 w-5 text-stone-400" />
            {isScanning ? 'Scanning...' : 'Scan Receipt'}
          </button>
          <button
            onClick={handleSyncBank}
            disabled={isSyncing}
            className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-50"
          >
            <RefreshCw className={`-ml-0.5 mr-1.5 h-5 w-5 text-stone-400 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Bank'}
          </button>
          <button
            onClick={() => { setScannedData(null); setShowAddModal(true); }}
            className="inline-flex items-center rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
          >
            <Plus className="-ml-0.5 mr-1.5 h-5 w-5" />
            Add Transaction
          </button>
        </div>
      </div>

      {/* Metrics */}
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="overflow-hidden rounded-xl bg-white px-4 py-5 shadow-sm border border-stone-200 sm:p-6">
          <dt className="truncate text-sm font-medium text-stone-500">Net Income</dt>
          <dd className={`mt-1 text-3xl font-semibold tracking-tight ${netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ${netIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </dd>
        </div>
        <div className="overflow-hidden rounded-xl bg-white px-4 py-5 shadow-sm border border-stone-200 sm:p-6">
          <dt className="truncate text-sm font-medium text-stone-500">Total Income</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
            ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </dd>
        </div>
        <div className="overflow-hidden rounded-xl bg-white px-4 py-5 shadow-sm border border-stone-200 sm:p-6">
          <dt className="truncate text-sm font-medium text-stone-500">Total Expenses</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
            ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </dd>
        </div>
        <div className="overflow-hidden rounded-xl bg-white px-4 py-5 shadow-sm border border-stone-200 sm:p-6">
          <dt className="truncate text-sm font-medium text-stone-500">Pending Reconciliation</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-amber-600">
            {pendingCount}
          </dd>
        </div>
      </dl>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="relative flex-1 w-full max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-stone-400" />
          </div>
          <input
            type="text"
            className="block w-full rounded-md border-0 py-1.5 pl-10 text-stone-900 ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:ring-2 focus:ring-inset focus:ring-stone-900 sm:text-sm sm:leading-6"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-stone-900 ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-stone-900 sm:text-sm sm:leading-6"
          >
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
          </select>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white shadow-sm ring-1 ring-stone-200 sm:rounded-xl overflow-hidden">
        <table className="min-w-full divide-y divide-stone-200">
          <thead className="bg-stone-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-stone-900 sm:pl-6">Date</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-stone-900">Description</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-stone-900">Category</th>
              <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-stone-900">Receipt</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-stone-900">Amount</th>
              <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-stone-900">Status</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-stone-500">Loading transactions...</td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-stone-500">No transactions found.</td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-stone-50 transition-colors">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-stone-500 sm:pl-6">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="py-4 pl-3 pr-3 text-sm font-medium text-stone-900">
                    <div className="flex items-center gap-2">
                      {tx.type === 'income' ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                      )}
                      {tx.description}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-stone-500 capitalize">
                    <div className="relative group">
                      <select
                        value={tx.category}
                        onChange={(e) => handleUpdateCategory(tx.id, e.target.value as Transaction['category'])}
                        className={twMerge(
                          clsx(
                            "block w-full max-w-[140px] rounded-md border-0 py-1 pl-2 pr-8 text-stone-900 ring-1 ring-inset focus:ring-2 sm:text-xs sm:leading-6 appearance-none cursor-pointer transition-colors",
                            tx.category === 'uncategorized' 
                              ? "ring-amber-300 focus:ring-amber-600 bg-amber-50 hover:bg-amber-100" 
                              : "ring-stone-200 focus:ring-stone-500 bg-stone-50 hover:bg-stone-100"
                          )
                        )}
                      >
                        <option value="uncategorized">Uncategorized</option>
                        <option value="donation">Donation</option>
                        <option value="grant">Grant</option>
                        <option value="operational">Operational</option>
                        <option value="program">Program</option>
                        <option value="other">Other</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronDown className="h-3 w-3 text-stone-400" />
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                    {tx.receiptUrl ? (
                      <a 
                        href={tx.receiptUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center text-stone-400 hover:text-emerald-600"
                        title="View Receipt"
                      >
                        <Paperclip className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-stone-300">-</span>
                    )}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-4 text-sm font-medium text-right ${tx.type === 'income' ? 'text-emerald-600' : 'text-stone-900'}`}>
                    {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                    <button
                      onClick={() => toggleStatus(tx)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        tx.status === 'reconciled' 
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      {tx.status === 'reconciled' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                      {tx.status}
                    </button>
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    {role === 'admin' && (
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Add Transaction</h3>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700">Type</label>
                <select
                  name="type"
                  required
                  defaultValue={scannedData?.type || "income"}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 text-stone-900 ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-stone-900 sm:text-sm sm:leading-6"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-700">Date</label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={scannedData?.date || new Date().toISOString().split('T')[0]}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 text-stone-900 ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-stone-900 sm:text-sm sm:leading-6"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700">Description</label>
                <input
                  type="text"
                  name="description"
                  required
                  defaultValue={scannedData?.description || ""}
                  placeholder="e.g., Office Supplies, Monthly Grant"
                  className="mt-1 block w-full rounded-md border-0 py-1.5 text-stone-900 ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-stone-900 sm:text-sm sm:leading-6"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700">Amount ($)</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={scannedData?.amount || ""}
                  placeholder="0.00"
                  className="mt-1 block w-full rounded-md border-0 py-1.5 text-stone-900 ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-stone-900 sm:text-sm sm:leading-6"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700">Category</label>
                <select
                  name="category"
                  required
                  defaultValue={scannedData?.category || "auto"}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 text-stone-900 ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-stone-900 sm:text-sm sm:leading-6"
                >
                  <option value="auto">Auto-Categorize</option>
                  <option value="donation">Donation</option>
                  <option value="grant">Grant</option>
                  <option value="operational">Operational</option>
                  <option value="program">Program</option>
                  <option value="other">Other</option>
                  <option value="uncategorized">Uncategorized</option>
                </select>
              </div>

              <div>
                <FileUpload 
                  folder="receipts" 
                  label="Receipt / Invoice" 
                  defaultUrl={receiptUrl} 
                  onUploadComplete={setReceiptUrl} 
                  onFileSelect={setSelectedFile}
                  onUploadingChange={setIsUploadingReceipt}
                />
                {selectedFile && !scannedData && (
                  <button
                    type="button"
                    onClick={handleMagicScan}
                    disabled={isMagicScanning}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <Sparkles className={twMerge(clsx("h-4 w-4", isMagicScanning && "animate-pulse"))} />
                    {isMagicScanning ? 'Analyzing Receipt...' : 'Magic Scan with AI'}
                  </button>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setScannedData(null); setReceiptUrl(''); setShowAddModal(false); }}
                  className="rounded-md px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingReceipt}
                  className="rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingReceipt ? 'Uploading...' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
