import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { Search, Plus, Mail, Phone, Tag, DollarSign, Gift, Clock, Settings, CheckCircle, RefreshCw } from 'lucide-react';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  type: string;
  totalDonated: number;
  tags: string[];
  skills?: string[];
  availability?: string;
  hoursLogged?: number;
}

function DonorAutomations({ contacts }: { contacts: Contact[] }) {
  const [settings, setSettings] = useState({
    thankYouEmails: true,
    quarterlyUpdates: false,
    thankYouTemplate: 'Dear {firstName},\n\nThank you for your generous donation of {amount}. Your support makes our work possible.\n\nSincerely,\nThe Team',
    quarterlyTemplate: 'Dear {firstName},\n\nHere is what we accomplished this quarter thanks to your support...\n\nSincerely,\nThe Team'
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendingQuarterly, setSendingQuarterly] = useState(false);
  const [quarterlySent, setQuarterlySent] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'automations'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as any);
      }
    });
    return unsub;
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'automations'), settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSendQuarterly = async () => {
    if (!confirm('Are you sure you want to send the quarterly update to all donors?')) return;
    setSendingQuarterly(true);
    try {
      const donors = contacts.filter(c => c.type === 'donor' && c.email);
      let sentCount = 0;
      for (const donor of donors) {
        let template = settings.quarterlyTemplate || 'Dear {firstName},\n\nHere is what we accomplished this quarter thanks to your support...\n\nSincerely,\nThe Team';
        template = template.replace(/{firstName}/g, donor.firstName)
                           .replace(/{lastName}/g, donor.lastName);
        
        const response = await fetch('/api/emails/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: donor.email,
            subject: 'Quarterly Impact Update',
            text: template
          })
        });
        if (response.ok) sentCount++;
      }
      setQuarterlySent(true);
      setTimeout(() => setQuarterlySent(false), 5000);
      alert(`Quarterly update sent to ${sentCount} donors.`);
    } catch (e) {
      console.error(e);
      alert('Failed to send quarterly updates.');
    } finally {
      setSendingQuarterly(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <h4 className="text-lg font-medium text-stone-900 mb-6 flex items-center gap-2">
          <Mail className="h-5 w-5 text-stone-400" />
          Automated Thank You Emails
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-sm font-medium text-stone-900">Enable Automatic Thank You Emails</h5>
              <p className="text-sm text-stone-500">Send an email immediately after a donation is recorded.</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, thankYouEmails: !s.thankYouEmails }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${settings.thankYouEmails ? 'bg-emerald-600' : 'bg-stone-200'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.thankYouEmails ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {settings.thankYouEmails && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Email Template</label>
              <textarea
                rows={5}
                value={settings.thankYouTemplate}
                onChange={e => setSettings(s => ({ ...s, thankYouTemplate: e.target.value }))}
                className="block w-full rounded-md border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              />
              <p className="mt-2 text-xs text-stone-500">Available variables: {'{firstName}'}, {'{lastName}'}, {'{amount}'}, {'{date}'}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <h4 className="text-lg font-medium text-stone-900 mb-6 flex items-center gap-2">
          <Clock className="h-5 w-5 text-stone-400" />
          Quarterly Impact Updates
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-sm font-medium text-stone-900">Enable Quarterly Updates</h5>
              <p className="text-sm text-stone-500">Automatically send impact reports to active donors every quarter.</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, quarterlyUpdates: !s.quarterlyUpdates }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${settings.quarterlyUpdates ? 'bg-emerald-600' : 'bg-stone-200'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.quarterlyUpdates ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {settings.quarterlyUpdates && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Email Template</label>
              <textarea
                rows={5}
                value={settings.quarterlyTemplate}
                onChange={e => setSettings(s => ({ ...s, quarterlyTemplate: e.target.value }))}
                className="block w-full rounded-md border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              />
              <p className="mt-2 text-xs text-stone-500">Available variables: {'{firstName}'}, {'{lastName}'}</p>
              
              <div className="mt-4 pt-4 border-t border-stone-100 flex justify-end">
                <button
                  onClick={handleSendQuarterly}
                  disabled={sendingQuarterly}
                  className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
                >
                  {sendingQuarterly ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Send Quarterly Update Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end items-center gap-4">
        {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Saved!</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Automations
        </button>
      </div>
    </div>
  );
}

export function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [donationType, setDonationType] = useState<'monetary' | 'in-kind'>('monetary');
  const [contactTypeFilter, setContactTypeFilter] = useState('All Types');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'directory' | 'automations'>('directory');
  const [newContactType, setNewContactType] = useState('donor');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { role } = useAuth();

  useEffect(() => {
    if (role === 'volunteer') {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'contacts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactsData: Contact[] = [];
      snapshot.forEach((doc) => {
        contactsData.push({ id: doc.id, ...doc.data() } as Contact);
      });
      setContacts(contactsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'contacts');
      setLoading(false);
    });

    return unsubscribe;
  }, [role]);

  if (role === 'volunteer') {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-stone-900">Access Denied</h2>
        <p className="mt-2 text-stone-500">You do not have permission to view contacts.</p>
      </div>
    );
  }

  const handleAddContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const newDocRef = doc(collection(db, 'contacts'));
      const type = formData.get('type') as string;
      const skills = (formData.get('skills') as string || '').split(',').map(s => s.trim()).filter(Boolean);
      
      await setDoc(newDocRef, {
        id: newDocRef.id,
        firstName: formData.get('firstName') || '',
        lastName: formData.get('lastName') || '',
        email: formData.get('email') || '',
        phone: formData.get('phone') || '',
        type: type,
        totalDonated: 0,
        hoursLogged: 0,
        skills: type === 'volunteer' ? skills : [],
        availability: type === 'volunteer' ? (formData.get('availability') || '') : '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewContactType('donor');
      setSuccess("Contact added successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'contacts');
    }
  };

  const handleAddDonation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedContact) return;
    
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string) || 0;
    const type = formData.get('donationType') as 'monetary' | 'in-kind';
    const itemDescription = formData.get('itemDescription') as string || '';
    const date = formData.get('date') as string || new Date().toISOString().split('T')[0];
    const sendReceipt = formData.get('sendReceipt') === 'on';

    try {
      const newDocRef = doc(collection(db, 'donations'));
      await setDoc(newDocRef, {
        id: newDocRef.id,
        contactId: selectedContact.id,
        donorName: `${selectedContact.firstName} ${selectedContact.lastName}`,
        amount: amount,
        donationType: type,
        itemDescription: type === 'in-kind' ? itemDescription : null,
        receiptSent: sendReceipt,
        date: new Date(date).toISOString(),
        source: 'manual',
        fund: 'general',
        campaign: 'general',
        status: 'completed',
        createdAt: new Date().toISOString()
      });

      const contactRef = doc(db, 'contacts', selectedContact.id);
      await setDoc(contactRef, {
        totalDonated: (selectedContact.totalDonated || 0) + amount,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Check automation settings
      const automationsDoc = await getDoc(doc(db, 'settings', 'automations'));
      const automations = automationsDoc.exists() ? automationsDoc.data() : null;

      let emailSent = false;
      if (automations?.thankYouEmails && selectedContact.email) {
        let template = automations.thankYouTemplate || 'Dear {firstName},\n\nThank you for your generous donation of {amount}. Your support makes our work possible.\n\nSincerely,\nThe Team';
        template = template.replace(/{firstName}/g, selectedContact.firstName)
                           .replace(/{lastName}/g, selectedContact.lastName)
                           .replace(/{amount}/g, `$${amount.toFixed(2)}`)
                           .replace(/{date}/g, date);

        try {
          const response = await fetch('/api/emails/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: selectedContact.email,
              subject: 'Thank You for Your Donation',
              text: template
            })
          });
          if (response.ok) {
            emailSent = true;
          }
        } catch (err) {
          console.error('Failed to send automated thank you email:', err);
        }
      }

      if (emailSent) {
        setSuccess(`Donation recorded. Automated thank you email sent to ${selectedContact.email}.`);
        setTimeout(() => setSuccess(null), 5000);
      } else if (sendReceipt) {
        setSuccess(`Donation recorded. Tax receipt marked as sent.`);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setSuccess("Donation recorded successfully.");
        setTimeout(() => setSuccess(null), 3000);
      }

      setShowDonationModal(false);
      setSelectedContact(null);
      setDonationType('monetary');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'donations');
    }
  };

  const handleLogHours = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedContact) return;
    
    const formData = new FormData(e.currentTarget);
    const hours = parseFloat(formData.get('hours') as string) || 0;
    const date = formData.get('date') as string || new Date().toISOString().split('T')[0];
    const activity = formData.get('activity') as string || '';

    try {
      // Update contact hours
      const contactRef = doc(db, 'contacts', selectedContact.id);
      await setDoc(contactRef, {
        hoursLogged: (selectedContact.hoursLogged || 0) + hours,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Record activity in a separate collection for reporting
      const logRef = doc(collection(db, 'volunteerHours'));
      await setDoc(logRef, {
        id: logRef.id,
        contactId: selectedContact.id,
        volunteerName: `${selectedContact.firstName} ${selectedContact.lastName}`,
        hours: hours,
        date: new Date(date).toISOString(),
        activity: activity,
        createdAt: new Date().toISOString()
      });
      
      setSuccess(`Successfully logged ${hours} hours for ${selectedContact.firstName}.`);
      setTimeout(() => setSuccess(null), 3000);
      setShowHoursModal(false);
      setSelectedContact(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'volunteerHours');
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                          contact.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = contactTypeFilter === 'All Types' || contact.type.toLowerCase() === contactTypeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between border-b border-stone-200 pb-5">
        <div>
          <h3 className="text-2xl font-semibold leading-6 text-stone-900">Donors & Grants</h3>
          <p className="mt-2 text-sm text-stone-500">
            Manage your donor profiles, grantors, and sponsors.
          </p>
        </div>
        <div className="mt-4 sm:ml-4 sm:mt-0">
          {(role === 'admin' || role === 'staff') && activeTab === 'directory' && (
            <button
              onClick={() => setShowAddModal(true)}
              type="button"
              className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
              New Contact
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-stone-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('directory')}
            className={`${
              activeTab === 'directory'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            Directory
          </button>
          <button
            onClick={() => setActiveTab('automations')}
            className={`${
              activeTab === 'automations'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            Automations & Retention
          </button>
        </nav>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <h3 className="text-sm font-medium text-red-800">{error}</h3>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-emerald-50 p-4 border border-emerald-200">
          <h3 className="text-sm font-medium text-emerald-800">{success}</h3>
        </div>
      )}

      {activeTab === 'automations' ? (
        <DonorAutomations contacts={contacts} />
      ) : (
        <>
          {/* Search and Filter */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-grow max-w-lg">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-stone-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                className="block w-full rounded-md border-0 py-1.5 pl-10 text-stone-900 ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              value={contactTypeFilter}
              onChange={(e) => setContactTypeFilter(e.target.value)}
              className="block rounded-md border-0 py-1.5 pl-3 pr-10 text-stone-900 ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm sm:leading-6"
            >
              <option>All Types</option>
              <option>Donor</option>
              <option>Grantor</option>
              <option>Sponsor</option>
              <option>Volunteer</option>
            </select>
          </div>

          {/* Contact List */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <p className="text-stone-500">Loading contacts...</p>
            ) : filteredContacts.length === 0 ? (
              <p className="text-stone-500">No contacts found. Add one to get started.</p>
            ) : (
              filteredContacts.map((contact) => (
                <div key={contact.id} className="col-span-1 divide-y divide-stone-200 rounded-xl bg-white shadow-sm border border-stone-200">
                  <div className="flex w-full items-center justify-between space-x-6 p-6">
                    <div className="flex-1 truncate">
                      <div className="flex items-center space-x-3">
                        <h3 className="truncate text-sm font-medium text-stone-900">
                          {contact.firstName} {contact.lastName}
                        </h3>
                        <span className="inline-flex flex-shrink-0 items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 capitalize">
                          {contact.type}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-stone-500 flex items-center gap-2">
                        <Mail className="w-4 h-4" /> {contact.email || 'No email'}
                      </p>
                      <p className="mt-1 truncate text-sm text-stone-500 flex items-center gap-2">
                        <Phone className="w-4 h-4" /> {contact.phone || 'No phone'}
                      </p>
                      {contact.type === 'volunteer' && (
                        <div className="mt-3">
                          <p className="text-xs text-stone-500">
                            <span className="font-semibold">Skills:</span> {contact.skills?.join(', ') || 'None listed'}
                          </p>
                          <p className="text-xs text-stone-500 mt-1">
                            <span className="font-semibold">Hours:</span> {contact.hoursLogged || 0} hrs
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="-mt-px flex divide-x divide-stone-200">
                      {contact.type === 'volunteer' ? (
                        <div className="flex w-0 flex-1">
                          <button
                            onClick={() => {
                              setSelectedContact(contact);
                              setShowHoursModal(true);
                            }}
                            className="relative inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-bl-lg border border-transparent py-4 text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          >
                            <Clock className="h-5 w-5 text-stone-400" aria-hidden="true" />
                            Log Hours
                          </button>
                        </div>
                      ) : (
                        <div className="flex w-0 flex-1">
                          <div className="relative -mr-px inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-bl-lg border border-transparent py-4 text-sm font-semibold text-stone-900">
                            <DollarSign className="h-5 w-5 text-stone-400" aria-hidden="true" />
                            ${contact.totalDonated?.toLocaleString() || '0'}
                          </div>
                        </div>
                      )}
                      <div className="-ml-px flex w-0 flex-1">
                        <button
                          onClick={() => {
                            setSelectedContact(contact);
                            setShowDonationModal(true);
                          }}
                          className="relative inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-br-lg border border-transparent py-4 text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        >
                          <Gift className="h-5 w-5" aria-hidden="true" />
                          {contact.type === 'volunteer' ? 'Record In-Kind' : 'Record Gift'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-stone-500 bg-opacity-75 transition-opacity"></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <form onSubmit={handleAddContact}>
                  <div>
                    <h3 className="text-base font-semibold leading-6 text-stone-900" id="modal-title">Add New Contact</h3>
                    <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium leading-6 text-stone-900">First name</label>
                        <div className="mt-2">
                          <input type="text" name="firstName" id="firstName" required className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="lastName" className="block text-sm font-medium leading-6 text-stone-900">Last name</label>
                        <div className="mt-2">
                          <input type="text" name="lastName" id="lastName" required className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="email" className="block text-sm font-medium leading-6 text-stone-900">Email address</label>
                        <div className="mt-2">
                          <input id="email" name="email" type="email" className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="phone" className="block text-sm font-medium leading-6 text-stone-900">Phone number</label>
                        <div className="mt-2">
                          <input type="text" name="phone" id="phone" className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="type" className="block text-sm font-medium leading-6 text-stone-900">Contact Type</label>
                        <div className="mt-2">
                          <select 
                            id="type" 
                            name="type" 
                            value={newContactType}
                            onChange={(e) => setNewContactType(e.target.value)}
                            className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6"
                          >
                            <option value="donor">Donor</option>
                            <option value="grantor">Grantor</option>
                            <option value="sponsor">Sponsor</option>
                            <option value="volunteer">Volunteer</option>
                          </select>
                        </div>
                      </div>

                      {newContactType === 'volunteer' && (
                        <>
                          <div className="sm:col-span-2">
                            <label htmlFor="skills" className="block text-sm font-medium leading-6 text-stone-900">Skills (comma separated)</label>
                            <div className="mt-2">
                              <input type="text" name="skills" id="skills" placeholder="e.g., Tutoring, Event Planning, Web Design" className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                            </div>
                          </div>
                          <div className="sm:col-span-2">
                            <label htmlFor="availability" className="block text-sm font-medium leading-6 text-stone-900">Availability</label>
                            <div className="mt-2">
                              <input type="text" name="availability" id="availability" placeholder="e.g., Weekends, Tuesday Evenings" className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button type="submit" className="inline-flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:col-start-2">
                      Save Contact
                    </button>
                    <button type="button" onClick={() => setShowAddModal(false)} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50 sm:col-start-1 sm:mt-0">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Hours Modal */}
      {showHoursModal && selectedContact && (
        <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-stone-500 bg-opacity-75 transition-opacity"></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <form onSubmit={handleLogHours}>
                  <div>
                    <h3 className="text-base font-semibold leading-6 text-stone-900" id="modal-title">
                      Log Volunteer Hours for {selectedContact.firstName} {selectedContact.lastName}
                    </h3>
                    <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                      <div className="sm:col-span-2">
                        <label htmlFor="hours" className="block text-sm font-medium leading-6 text-stone-900">Number of Hours</label>
                        <div className="mt-2">
                          <input type="number" step="0.5" min="0" name="hours" id="hours" required className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="date" className="block text-sm font-medium leading-6 text-stone-900">Date</label>
                        <div className="mt-2">
                          <input type="date" name="date" id="date" required defaultValue={new Date().toISOString().split('T')[0]} className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="activity" className="block text-sm font-medium leading-6 text-stone-900">Activity Description</label>
                        <div className="mt-2">
                          <input type="text" name="activity" id="activity" required placeholder="e.g., Mentoring session, Event setup" className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button type="submit" className="inline-flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:col-start-2">
                      Log Hours
                    </button>
                    <button type="button" onClick={() => { setShowHoursModal(false); setSelectedContact(null); }} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50 sm:col-start-1 sm:mt-0">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Donation Modal */}
      {showDonationModal && selectedContact && (
        <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-stone-500 bg-opacity-75 transition-opacity"></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <form onSubmit={handleAddDonation}>
                  <div>
                    <h3 className="text-base font-semibold leading-6 text-stone-900" id="modal-title">
                      Record Gift for {selectedContact.firstName} {selectedContact.lastName}
                    </h3>
                    <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                      
                      <div className="sm:col-span-2">
                        <label htmlFor="donationType" className="block text-sm font-medium leading-6 text-stone-900">Gift Type</label>
                        <div className="mt-2">
                          <select 
                            id="donationType" 
                            name="donationType" 
                            value={donationType}
                            onChange={(e) => setDonationType(e.target.value as 'monetary' | 'in-kind')}
                            className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6"
                          >
                            <option value="monetary">Monetary Donation</option>
                            <option value="in-kind">In-Kind (Tangible Item)</option>
                          </select>
                        </div>
                      </div>

                      {donationType === 'in-kind' && (
                        <div className="sm:col-span-2">
                          <label htmlFor="itemDescription" className="block text-sm font-medium leading-6 text-stone-900">Item Description</label>
                          <div className="mt-2">
                            <input type="text" name="itemDescription" id="itemDescription" required placeholder="e.g., 5 Laptops, Canned Goods" className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                          </div>
                        </div>
                      )}

                      <div className="sm:col-span-2">
                        <label htmlFor="amount" className="block text-sm font-medium leading-6 text-stone-900">
                          {donationType === 'in-kind' ? 'Estimated Value ($)' : 'Amount ($)'}
                        </label>
                        <div className="mt-2">
                          <input type="number" step="0.01" min="0" name="amount" id="amount" required className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label htmlFor="date" className="block text-sm font-medium leading-6 text-stone-900">Date</label>
                        <div className="mt-2">
                          <input type="date" name="date" id="date" required defaultValue={new Date().toISOString().split('T')[0]} className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                        </div>
                      </div>

                      <div className="sm:col-span-2 flex items-center gap-3 mt-2">
                        <input type="checkbox" id="sendReceipt" name="sendReceipt" defaultChecked className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-600" />
                        <label htmlFor="sendReceipt" className="text-sm font-medium text-stone-900">
                          Automatically send thank you email & tax receipt
                        </label>
                      </div>

                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button type="submit" className="inline-flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:col-start-2">
                      Save & Send
                    </button>
                    <button type="button" onClick={() => { setShowDonationModal(false); setSelectedContact(null); }} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50 sm:col-start-1 sm:mt-0">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
