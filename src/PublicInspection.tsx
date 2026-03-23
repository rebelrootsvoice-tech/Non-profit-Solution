import React, { useState, useEffect } from 'react';
import { ShieldCheck, FileText, CheckCircle, ExternalLink, Globe } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

interface ComplianceItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  dueDate: string;
  status: string;
  documentUrl?: string;
}

export function PublicInspection() {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only show approved items publicly
    const q = query(
      collection(db, 'compliance'), 
      where('status', '==', 'approved')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const complianceData: ComplianceItem[] = [];
      snapshot.forEach((doc) => {
        complianceData.push({ id: doc.id, ...doc.data() } as ComplianceItem);
      });
      // Sort by due date descending (most recent first)
      complianceData.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
      setItems(complianceData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching public documents:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-100 rounded-full mb-4">
            <ShieldCheck className="h-8 w-8 text-emerald-700" />
          </div>
          <h1 className="text-3xl font-bold text-stone-900">Public Inspection & Compliance</h1>
          <p className="mt-2 text-stone-600">
            Transparency is core to our mission. Below are our official filings, policies, and compliance records.
          </p>
        </div>

        <div className="bg-white shadow-sm rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">Verified Documents</h2>
            <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              <CheckCircle className="h-3.5 w-3.5" />
              Live Verification
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-stone-500">Loading documents...</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-stone-500">
              <FileText className="h-12 w-12 text-stone-300 mx-auto mb-4" />
              <p>No public documents are currently available for inspection.</p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {items.map((item) => (
                <li key={item.id} className="p-6 hover:bg-stone-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-grow">
                      <h3 className="text-md font-medium text-stone-900 mb-1">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-stone-500 mb-3">{item.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-stone-400">
                        <span className="uppercase tracking-wider">{item.type}</span>
                        <span>&middot;</span>
                        <span>Verified: {new Date(item.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {item.documentUrl && (
                      <a 
                        href={item.documentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-900"
                      >
                        View <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-stone-400 flex items-center justify-center gap-2">
            <Globe className="h-4 w-4" />
            Powered by Nonprofit OS Transparency Engine
          </p>
        </div>
      </div>
    </div>
  );
}
