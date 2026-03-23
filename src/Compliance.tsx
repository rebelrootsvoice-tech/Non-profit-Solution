import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Plus, Search, Filter, Trash2, CheckCircle, Clock, AlertCircle, FileText, Calculator, BookOpen, Settings, RefreshCw, ExternalLink } from 'lucide-react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { FileUpload } from './components/FileUpload';
import { format, addMonths, startOfMonth, endOfMonth, isAfter, isBefore, parseISO } from 'date-fns';

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

interface OrganizationSettings {
  fiscalYearEnd: string; // MM-DD
  states: string[];
  ein?: string;
  uei?: string;
  samRenewalDate?: string;
  hasUBI?: boolean;
  receivesGovtFunds?: boolean;
  readiness?: {
    irsDeterminationLetter?: string;
    articlesOfIncorporation?: string;
    bylaws?: string;
    prior990s?: string;
    payrollSystemConfirmed?: boolean;
    sosStanding?: string;
    charitablePermit?: string;
    salesTaxExemption?: string;
    coiPolicy?: boolean;
    whistleblowerPolicy?: boolean;
    retentionPolicy?: boolean;
    boardMinutes?: string;
    procurementPolicy?: boolean;
    timeEffortTracking?: boolean;
    indirectCostRate?: string;
  };
  updatedAt: string;
}

const STATE_REQUIREMENTS: Record<string, { corporate: string; charitable: string }> = {
  'Alabama': { corporate: '2.5 months after fiscal year-end', charitable: 'Annually (based on registration date)' },
  'Alaska': { corporate: 'Jan 2 (odd/even years based on formation)', charitable: 'September 1' },
  'Arizona': { corporate: 'Anniversary of incorporation', charitable: 'N/A (State does not require registration)' },
  'Arkansas': { corporate: 'May 1', charitable: 'Based on registration date' },
  'California': { corporate: 'Biennial (every 2 years) by end of anniversary month', charitable: '4 months & 15 days after fiscal year-end' },
  'Colorado': { corporate: 'Anniversary of formation', charitable: '4 months & 15 days after fiscal year-end' },
  'Connecticut': { corporate: 'Anniversary of formation', charitable: 'Annually (based on registration date)' },
  'Delaware': { corporate: 'March 1', charitable: 'N/A (State does not require registration)' },
  'Florida': { corporate: 'May 1', charitable: 'Annually (based on registration date)' },
  'Georgia': { corporate: 'Anniversary of formation', charitable: 'Annually (based on registration date)' },
  'Hawaii': { corporate: 'Anniversary of formation', charitable: '4 months & 15 days after fiscal year-end' },
  'Idaho': { corporate: 'Anniversary of formation', charitable: 'N/A (State does not require registration)' },
  'Illinois': { corporate: 'Anniversary of formation', charitable: '6 months after fiscal year-end' },
  'Indiana': { corporate: 'Biennial (every 2 years) by end of anniversary month', charitable: 'N/A (State does not require registration)' },
  'Iowa': { corporate: 'Biennial (odd years) by April 1', charitable: 'N/A (State does not require registration)' },
  'Kansas': { corporate: '15th day of 6th month after fiscal year-end', charitable: 'Annually (based on registration date)' },
  'Kentucky': { corporate: 'June 30', charitable: 'Annually (based on registration date)' },
  'Louisiana': { corporate: 'Anniversary of formation', charitable: 'Annually (based on registration date)' },
  'Maine': { corporate: 'June 1', charitable: 'Annually (based on registration date)' },
  'Maryland': { corporate: 'April 15', charitable: '4 months & 15 days after fiscal year-end' },
  'Massachusetts': { corporate: 'Nov 1', charitable: '4 months & 15 days after fiscal year-end' },
  'Michigan': { corporate: 'Oct 1', charitable: '7 months after fiscal year-end' },
  'Minnesota': { corporate: 'Dec 31', charitable: 'Annually (based on registration date)' },
  'Mississippi': { corporate: 'Anniversary of formation', charitable: '4 months & 15 days after fiscal year-end' },
  'Missouri': { corporate: 'Anniversary of formation', charitable: 'Annually (based on registration date)' },
  'Montana': { corporate: 'April 15', charitable: 'N/A (State does not require registration)' },
  'Nebraska': { corporate: 'Biennial (even years) by April 1', charitable: 'N/A (State does not require registration)' },
  'Nevada': { corporate: 'Anniversary of formation', charitable: 'Annually (based on registration date)' },
  'New Hampshire': { corporate: 'Biennial (every 5 years) by Dec 31', charitable: '4 months & 15 days after fiscal year-end' },
  'New Jersey': { corporate: 'Anniversary of formation', charitable: '6 months after fiscal year-end' },
  'New Mexico': { corporate: '15th day of 5th month after fiscal year-end', charitable: '6 months after fiscal year-end' },
  'New York': { corporate: 'Biennial (every 2 years) by end of anniversary month', charitable: '4 months & 15 days after fiscal year-end' },
  'North Carolina': { corporate: '15th day of 4th month after fiscal year-end', charitable: '4 months & 15 days after fiscal year-end' },
  'North Dakota': { corporate: 'Feb 1', charitable: 'September 1' },
  'Ohio': { corporate: 'Every 5 years', charitable: '4 months & 15 days after fiscal year-end' },
  'Oklahoma': { corporate: 'Anniversary of formation', charitable: 'Annually (based on registration date)' },
  'Oregon': { corporate: 'Anniversary of formation', charitable: '4 months & 15 days after fiscal year-end' },
  'Pennsylvania': { corporate: 'Every 10 years', charitable: '4 months & 15 days after fiscal year-end' },
  'Rhode Island': { corporate: 'June 30', charitable: 'Annually (based on registration date)' },
  'South Carolina': { corporate: '15th day of 5th month after fiscal year-end', charitable: '4.5 months after fiscal year-end' },
  'South Dakota': { corporate: 'Anniversary of formation', charitable: 'N/A (State does not require registration)' },
  'Tennessee': { corporate: '15th day of 4th month after fiscal year-end', charitable: '6 months after fiscal year-end' },
  'Texas': { corporate: 'N/A (State does not require annual report)', charitable: 'N/A (State does not require registration)' },
  'Utah': { corporate: 'Anniversary of formation', charitable: 'Annually (based on registration date)' },
  'Vermont': { corporate: '2.5 months after fiscal year-end', charitable: 'N/A (State does not require registration)' },
  'Virginia': { corporate: 'Anniversary of formation', charitable: '4 months & 15 days after fiscal year-end' },
  'Washington': { corporate: 'Anniversary of formation', charitable: '11 months after fiscal year-end' },
  'West Virginia': { corporate: 'June 30', charitable: 'Annually (based on registration date)' },
  'Wisconsin': { corporate: 'Anniversary of formation', charitable: 'Annually (based on registration date)' },
  'Wyoming': { corporate: 'Anniversary of formation', charitable: 'N/A (State does not require registration)' }
};

function ComplianceReference() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <h4 className="text-lg font-medium text-stone-900 mb-4">State-by-State Reporting Compliance (2025-2026)</h4>
        <p className="text-sm text-stone-500 mb-6">
          Nonprofit reporting requirements vary by state, generally falling into three categories: Corporate Annual Reports, Charitable Solicitation Renewals, and State Tax Exemption Renewals.
          For a complete list of official state-by-state agencies, refer to the <a href="https://www.nasconet.org/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">National Association of State Charity Officials (NASCO) <ExternalLink className="h-3 w-3" /></a>.
        </p>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200">
            <thead>
              <tr className="bg-stone-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">State</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Corporate Annual Report Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Charitable Solicitation Renewal</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {Object.entries(STATE_REQUIREMENTS).map(([state, reqs]) => (
                <tr key={state} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-stone-900">{state}</td>
                  <td className="px-4 py-3 text-sm text-stone-600">{reqs.corporate}</td>
                  <td className="px-4 py-3 text-sm text-stone-600">{reqs.charitable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <h4 className="text-lg font-medium text-stone-900 mb-4">Federal & General Requirements</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h5 className="font-medium text-stone-800">Donor Receipts</h5>
            <p className="text-sm text-stone-600">
              Recommended by January 31 for the previous tax year. IRS requires written acknowledgment for single donations of $250 or more.
            </p>
          </div>
          <div className="space-y-3">
            <h5 className="font-medium text-stone-800">IRS Form 990</h5>
            <p className="text-sm text-stone-600">
              Due the 15th day of the 5th month after the close of your fiscal year. 
              (e.g., May 15 for Dec 31 FYE).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplianceSettings({ settings, onSave }: { settings: OrganizationSettings | null; onSave: (s: OrganizationSettings) => void | Promise<void> }) {
  const [fye, setFye] = useState(settings?.fiscalYearEnd || '12-31');
  const [selectedStates, setSelectedStates] = useState<string[]>(settings?.states || []);
  const [ein, setEin] = useState(settings?.ein || '');
  const [uei, setUei] = useState(settings?.uei || '');
  const [samRenewal, setSamRenewal] = useState(settings?.samRenewalDate || '');
  const [hasUBI, setHasUBI] = useState(settings?.hasUBI || false);
  const [receivesGovtFunds, setReceivesGovtFunds] = useState(settings?.receivesGovtFunds || false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync with props when they load
  useEffect(() => {
    if (settings) {
      setFye(settings.fiscalYearEnd || '12-31');
      setSelectedStates(settings.states || []);
      setEin(settings.ein || '');
      setUei(settings.uei || '');
      setSamRenewal(settings.samRenewalDate || '');
      setHasUBI(settings.hasUBI || false);
      setReceivesGovtFunds(settings.receivesGovtFunds || false);
    }
  }, [settings]);

  const toggleState = (state: string) => {
    setSelectedStates(prev => 
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ 
        fiscalYearEnd: fye, 
        states: selectedStates, 
        ein, 
        uei, 
        samRenewalDate: samRenewal, 
        hasUBI, 
        receivesGovtFunds,
        readiness: settings?.readiness,
        updatedAt: new Date().toISOString() 
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      <h4 className="text-lg font-medium text-stone-900 mb-6 flex items-center gap-2">
        <Settings className="h-5 w-5 text-stone-400" />
        Organization Compliance Settings
      </h4>
      
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Fiscal Year End (MM-DD)</label>
            <input 
              type="text" 
              placeholder="12-31"
              value={fye}
              onChange={(e) => setFye(e.target.value)}
              className="block w-full rounded-md border-stone-300 shadow-sm focus:border-stone-900 focus:ring-stone-900 sm:text-sm"
            />
            <p className="mt-1 text-xs text-stone-500">Used to calculate IRS 990 and state reporting deadlines.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Employer Identification Number (EIN)</label>
            <input 
              type="text" 
              placeholder="00-0000000"
              value={ein}
              onChange={(e) => setEin(e.target.value)}
              className="block w-full rounded-md border-stone-300 shadow-sm focus:border-stone-900 focus:ring-stone-900 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">SAM.gov UEI Number</label>
            <input 
              type="text" 
              value={uei}
              onChange={(e) => setUei(e.target.value)}
              className="block w-full rounded-md border-stone-300 shadow-sm focus:border-stone-900 focus:ring-stone-900 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">SAM Renewal Date</label>
            <input 
              type="date" 
              value={samRenewal}
              onChange={(e) => setSamRenewal(e.target.value)}
              className="block w-full rounded-md border-stone-300 shadow-sm focus:border-stone-900 focus:ring-stone-900 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex gap-8">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={hasUBI}
              onChange={(e) => setHasUBI(e.target.checked)}
              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
            />
            <span className="text-sm font-medium text-stone-700">Earns Unrelated Business Income (UBI)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={receivesGovtFunds}
              onChange={(e) => setReceivesGovtFunds(e.target.checked)}
              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
            />
            <span className="text-sm font-medium text-stone-700">Receives Government Funds</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-4">Operating States</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Object.keys(STATE_REQUIREMENTS).map(state => (
              <label key={state} className="flex items-center gap-2 p-2 rounded-lg border border-stone-100 hover:bg-stone-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={selectedStates.includes(state)}
                  onChange={() => toggleState(state)}
                  className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                />
                <span className="text-xs text-stone-700">{state}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-4">
          {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Settings saved!</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReadinessChecklist({ settings, onSave }: { settings: OrganizationSettings | null; onSave: (s: OrganizationSettings) => void | Promise<void> }) {
  const [readiness, setReadiness] = useState(settings?.readiness || {});
  const [uploadingCount, setUploadingCount] = useState(0);

  const isUploading = uploadingCount > 0;

  // Sync with props when they load
  useEffect(() => {
    if (settings?.readiness) {
      setReadiness(settings.readiness);
    }
  }, [settings]);

  const updateReadiness = (field: keyof NonNullable<OrganizationSettings['readiness']>, value: any) => {
    const newReadiness = { ...readiness, [field]: value };
    setReadiness(newReadiness);
    const newSettings: OrganizationSettings = settings || {
      fiscalYearEnd: '12-31',
      states: [],
      receivesGovtFunds: false,
      updatedAt: new Date().toISOString()
    };
    onSave({ ...newSettings, readiness: newReadiness, updatedAt: new Date().toISOString() });
  };

  const phases = [
    {
      title: 'Phase 1: Foundations',
      items: [
        { id: 'irsDeterminationLetter', label: 'IRS Determination Letter', type: 'file' },
        { id: 'articlesOfIncorporation', label: 'Articles of Incorporation', type: 'file' },
        { id: 'bylaws', label: 'Bylaws', type: 'file' },
      ]
    },
    {
      title: 'Phase 2: Federal Compliance',
      items: [
        { id: 'prior990s', label: 'Prior 3 Years of Form 990s', type: 'file' },
        { id: 'payrollSystemConfirmed', label: 'Payroll System in Place', type: 'boolean' },
      ]
    },
    {
      title: 'Phase 3: State-Level "Right to Operate"',
      items: [
        { id: 'sosStanding', label: 'SOS Good Standing Certificate', type: 'file' },
        { id: 'charitablePermit', label: 'Charitable Solicitation Permit', type: 'file' },
        { id: 'salesTaxExemption', label: 'Sales Tax Exemption Certificate', type: 'file' },
      ]
    },
    {
      title: 'Phase 4: Governance',
      items: [
        { id: 'coiPolicy', label: 'Conflict of Interest Policy (2025)', type: 'boolean' },
        { id: 'whistleblowerPolicy', label: 'Whistleblower Policy', type: 'boolean' },
        { id: 'retentionPolicy', label: 'Document Retention Policy', type: 'boolean' },
        { id: 'boardMinutes', label: 'Board Meeting Minutes (Last 4 Quarters)', type: 'file' },
      ]
    }
  ];

  if (settings?.receivesGovtFunds) {
    phases.push({
      title: 'Phase 5: Grant-Specific Readiness',
      items: [
        { id: 'procurementPolicy', label: 'Procurement Policy', type: 'boolean' },
        { id: 'timeEffortTracking', label: 'Time & Effort Tracking System', type: 'boolean' },
        { id: 'indirectCostRate', label: 'Indirect Cost Rate (NICRA/De Minimis)', type: 'text' },
      ]
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-medium text-stone-900">Compliance Readiness Checklist</h4>
          {isUploading && (
            <span className="flex items-center gap-2 text-sm text-amber-600 font-medium animate-pulse">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Uploading documents...
            </span>
          )}
        </div>
        <p className="text-sm text-stone-500 mb-8">Complete these foundational steps to build a robust compliance profile.</p>

        <div className="space-y-10">
          {phases.map((phase, idx) => (
            <div key={idx} className="space-y-4">
              <h5 className="text-sm font-bold text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-2">{phase.title}</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {phase.items.map(item => (
                  <div key={item.id} className="space-y-2">
                    {item.type !== 'file' && <label className="block text-sm font-medium text-stone-900">{item.label}</label>}
                    {item.type === 'file' ? (
                      <FileUpload 
                        folder="readiness" 
                        label={item.label}
                        defaultUrl={(readiness as any)[item.id]} 
                        onUploadComplete={(url) => updateReadiness(item.id as any, url)} 
                        onUploadingChange={(uploading) => setUploadingCount(prev => uploading ? prev + 1 : Math.max(0, prev - 1))}
                      />
                    ) : item.type === 'boolean' ? (
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => updateReadiness(item.id as any, true)}
                          className={`px-3 py-1 text-xs rounded-full border ${ (readiness as any)[item.id] === true ? 'bg-emerald-100 border-emerald-500 text-emerald-700' : 'bg-white border-stone-200 text-stone-500' }`}
                        >
                          Confirmed
                        </button>
                        <button
                          onClick={() => updateReadiness(item.id as any, false)}
                          className={`px-3 py-1 text-xs rounded-full border ${ (readiness as any)[item.id] === false ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white border-stone-200 text-stone-500' }`}
                        >
                          Missing
                        </button>
                      </div>
                    ) : (
                      <input 
                        type="text"
                        value={(readiness as any)[item.id] || ''}
                        onChange={(e) => updateReadiness(item.id as any, e.target.value)}
                        className="block w-full rounded-md border-stone-300 shadow-sm focus:border-stone-900 focus:ring-stone-900 sm:text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
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
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'requirements' | 'irs990' | 'reference' | 'readiness' | 'settings'>('requirements');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'filing' | 'policy' | 'report' | 'other'>('filing');
  const [dueDate, setDueDate] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');

  useEffect(() => {
    // Fetch Settings
    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'org'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as OrganizationSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/org');
    });

    // Fetch Compliance Items
    const q = query(collection(db, 'compliance'));
    const itemsUnsubscribe = onSnapshot(q, (snapshot) => {
      const complianceData: ComplianceItem[] = [];
      snapshot.forEach((doc) => {
        complianceData.push({ id: doc.id, ...doc.data() } as ComplianceItem);
      });
      // Sort by due date ascending
      complianceData.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setItems(complianceData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'compliance');
      setLoading(false);
    });

    return () => {
      settingsUnsubscribe();
      itemsUnsubscribe();
    };
  }, []);

  const handleSaveSettings = async (newSettings: OrganizationSettings) => {
    try {
      setError(null);
      setSuccess(null);
      console.log("Saving settings to Firestore:", newSettings);
      await setDoc(doc(db, 'settings', 'org'), newSettings);
      setSuccess("Settings saved successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/org');
    }
  };

  const handleAutoGenerate = async () => {
    setError(null);
    setSuccess(null);
    if (!settings || !user) {
      setError("Please configure settings first in the Settings tab.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    if (!settings.fiscalYearEnd) {
      setError("Please set a Fiscal Year End in the Settings tab before generating.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    setGenerating(true);
    try {
      const currentYear = new Date().getFullYear();
      const [fyeMonth, fyeDay] = settings.fiscalYearEnd.split('-').map(Number);
      
      if (isNaN(fyeMonth) || isNaN(fyeDay)) {
        setError("Invalid Fiscal Year End format. Please update it in the Settings tab.");
        setTimeout(() => setError(null), 5000);
        setGenerating(false);
        return;
      }

      const fyeDate = new Date(currentYear, fyeMonth - 1, fyeDay);
      
      const newItems: Partial<ComplianceItem>[] = [];

      // 1. IRS 990 (15th day of 5th month after FYE)
      const irs990Due = addMonths(fyeDate, 4);
      irs990Due.setDate(15);
      newItems.push({
        title: `IRS Form 990 Filing (${currentYear})`,
        description: 'Annual information return for tax-exempt organizations.',
        type: 'filing',
        dueDate: irs990Due.toISOString()
      });

      // 2. Donor Receipts (Jan 31)
      newItems.push({
        title: `Donor Tax Receipts (${currentYear})`,
        description: 'Send annual contribution statements to all donors.',
        type: 'report',
        dueDate: new Date(currentYear + 1, 0, 31).toISOString()
      });

      // 3. State Requirements
      if (settings.states && Array.isArray(settings.states)) {
        settings.states.forEach(state => {
          const reqs = STATE_REQUIREMENTS[state];
          if (reqs) {
            // Corporate Annual Report
            newItems.push({
              title: `${state} Corporate Annual Report`,
              description: `Requirement: ${reqs.corporate}`,
              type: 'filing',
              dueDate: addMonths(new Date(), 3).toISOString()
            });

            if (reqs.charitable !== 'N/A (State does not require registration)') {
              newItems.push({
                title: `${state} Charitable Solicitation Renewal`,
                description: `Requirement: ${reqs.charitable}`,
                type: 'filing',
                dueDate: addMonths(new Date(), 6).toISOString()
              });
            }
          }
        });
      }

      // Batch add items
      for (const item of newItems) {
        const exists = items.find(i => i.title === item.title && new Date(i.dueDate).getFullYear() === new Date(item.dueDate!).getFullYear());
        if (!exists) {
          const newDocRef = doc(collection(db, 'compliance'));
          await setDoc(newDocRef, {
            ...item,
            id: newDocRef.id,
            status: 'pending',
            assignedTo: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }

      setSuccess("Compliance calendar updated!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'compliance');
    } finally {
      setGenerating(false);
    }
  };

  const readinessProgress = useMemo(() => {
    if (!settings?.readiness) return 0;
    const fields = [
      'irsDeterminationLetter', 'articlesOfIncorporation', 'bylaws',
      'payrollSystemConfirmed', 'sosStanding', 'charitablePermit',
      'salesTaxExemption', 'coiPolicy', 'whistleblowerPolicy', 'retentionPolicy'
    ];
    if (settings.receivesGovtFunds) {
      fields.push('procurementPolicy', 'timeEffortTracking', 'indirectCostRate');
    }
    
    const completed = fields.filter(f => !!(settings.readiness as any)[f]).length;
    return Math.round((completed / fields.length) * 100);
  }, [settings]);

  const healthScore = useMemo(() => {
    const overdueCount = items.filter(i => i.status === 'overdue').length;
    const pendingCount = items.filter(i => i.status === 'pending').length;
    
    // Base score from items
    let score = 100 - (overdueCount * 20) - (pendingCount * 2);
    
    // Incorporate readiness (weighted 40%)
    score = (score * 0.6) + (readinessProgress * 0.4);
    
    return Math.max(0, Math.round(score));
  }, [items, readinessProgress]);

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to add a requirement.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    if (!dueDate) {
      setError("Please select a due date.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    const parsedDate = new Date(dueDate);
    if (isNaN(parsedDate.getTime())) {
      setError("Invalid due date.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      setError(null);
      const newDocRef = doc(collection(db, 'compliance'));
      const newItem: ComplianceItem = {
        id: newDocRef.id,
        title,
        description: description || undefined,
        type,
        dueDate: parsedDate.toISOString(),
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
      setSuccess("Requirement added successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'compliance');
    }
  };

  const handleDelete = async (id: string) => {
    // We can't use window.confirm in iframe, so we'll just delete for now
    // In a real app, we'd use a custom modal
    try {
      setError(null);
      await deleteDoc(doc(db, 'compliance', id));
      setSuccess("Requirement deleted.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `compliance/${id}`);
    }
  };

  const handleStatusChange = async (id: string, newStatus: ComplianceItem['status']) => {
    try {
      setError(null);
      await updateDoc(doc(db, 'compliance', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `compliance/${id}`);
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
            Compliance Control Tower
          </h3>
          <p className="mt-2 text-sm text-stone-500">
            Deadlines, filings, policy reviews, and automated IRS 990 reporting.
          </p>
        </div>
        <div className="mt-4 sm:ml-4 sm:mt-0 flex gap-3">
          {(role === 'admin' || role === 'staff') && activeTab === 'requirements' && (
            <>
              <button
                onClick={handleAutoGenerate}
                disabled={generating}
                className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50 disabled:opacity-50"
              >
                <RefreshCw className={`-ml-0.5 mr-1.5 h-5 w-5 ${generating ? 'animate-spin' : ''}`} aria-hidden="true" />
                Sync Calendar
              </button>
              <button
                onClick={() => setIsAdding(!isAdding)}
                className="inline-flex items-center rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
              >
                <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                Add Requirement
              </button>
            </>
          )}
          <a 
            href={`${window.location.origin}/public-inspection`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-200"
          >
            <ExternalLink className="-ml-0.5 mr-1.5 h-4 w-4" />
            Public Page
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { id: 'requirements', name: 'Requirements Tracker', icon: ShieldCheck },
            { id: 'irs990', name: 'IRS 990 Automation', icon: Calculator },
            { id: 'readiness', name: 'Readiness Checklist', icon: CheckCircle },
            { id: 'reference', name: 'Compliance Reference', icon: BookOpen },
            { id: 'settings', name: 'Settings', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`group inline-flex items-center whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
              }`}
            >
              <tab.icon className={`-ml-0.5 mr-2 h-5 w-5 ${activeTab === tab.id ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-500'}`} />
              {tab.name}
              {tab.id === 'readiness' && readinessProgress < 100 && (
                <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                  {readinessProgress}%
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-emerald-50 p-4 border border-emerald-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-emerald-800">{success}</h3>
            </div>
          </div>
        </div>
      )}

      {readinessProgress < 80 && activeTab !== 'readiness' && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-lg">
              <CheckCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-900">Complete your Compliance Readiness Checklist</h4>
              <p className="text-sm text-amber-700">You've completed {readinessProgress}% of the foundational requirements. Reach 80% to earn your badge!</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('readiness')}
            className="text-sm font-medium text-amber-900 hover:underline"
          >
            Go to Checklist →
          </button>
        </div>
      )}

      {activeTab === 'irs990' ? (
        <IRS990Automation />
      ) : activeTab === 'reference' ? (
        <ComplianceReference />
      ) : activeTab === 'readiness' ? (
        <ReadinessChecklist settings={settings} onSave={handleSaveSettings} />
      ) : activeTab === 'settings' ? (
        <ComplianceSettings settings={settings} onSave={handleSaveSettings} />
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <div className="overflow-hidden rounded-xl bg-white px-4 py-5 shadow-sm border border-stone-200 sm:p-6">
              <div className="flex items-center justify-between">
                <dt className="truncate text-sm font-medium text-stone-500">Health Score</dt>
                {readinessProgress >= 80 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Compliance Ready
                  </span>
                )}
              </div>
              <dd className={`mt-1 text-3xl font-semibold tracking-tight ${healthScore > 80 ? 'text-emerald-600' : healthScore > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {healthScore}%
              </dd>
              <div className="mt-2 w-full bg-stone-100 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full ${healthScore > 80 ? 'bg-emerald-500' : healthScore > 50 ? 'bg-amber-500' : 'bg-red-500'}`} 
                  style={{ width: `${healthScore}%` }}
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-xl bg-white px-4 py-5 shadow-sm border border-stone-200 sm:p-6">
              <dt className="truncate text-sm font-medium text-stone-500">Pending</dt>
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
                  onUploadingChange={setIsUploading}
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
                disabled={isUploading}
                className="rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploading...' : 'Save Requirement'}
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
