import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { Search, Plus, Mail, Phone, Tag, DollarSign } from 'lucide-react';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  type: string;
  totalDonated: number;
  tags: string[];
}

export function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const { role } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'contacts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactsData: Contact[] = [];
      snapshot.forEach((doc) => {
        contactsData.push({ id: doc.id, ...doc.data() } as Contact);
      });
      setContacts(contactsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching contacts:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleAddContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const newDocRef = doc(collection(db, 'contacts'));
      await setDoc(newDocRef, {
        id: newDocRef.id,
        firstName: formData.get('firstName') || '',
        lastName: formData.get('lastName') || '',
        email: formData.get('email') || '',
        phone: formData.get('phone') || '',
        type: formData.get('type') || 'donor',
        totalDonated: 0,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setShowAddModal(false);
    } catch (error) {
      console.error("Error adding contact:", error);
      alert("Failed to add contact. Check permissions.");
    }
  };

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
          {(role === 'admin' || role === 'staff') && (
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
          />
        </div>
        <select className="block rounded-md border-0 py-1.5 pl-3 pr-10 text-stone-900 ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm sm:leading-6">
          <option>All Types</option>
          <option>Donor</option>
          <option>Grantor</option>
          <option>Sponsor</option>
        </select>
      </div>

      {/* Contact List */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-stone-500">Loading contacts...</p>
        ) : contacts.length === 0 ? (
          <p className="text-stone-500">No contacts found. Add one to get started.</p>
        ) : (
          contacts.map((contact) => (
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
                </div>
              </div>
              <div>
                <div className="-mt-px flex divide-x divide-stone-200">
                  <div className="flex w-0 flex-1">
                    <div className="relative -mr-px inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-bl-lg border border-transparent py-4 text-sm font-semibold text-stone-900">
                      <DollarSign className="h-5 w-5 text-stone-400" aria-hidden="true" />
                      ${contact.totalDonated?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="-ml-px flex w-0 flex-1">
                    <div className="relative inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-br-lg border border-transparent py-4 text-sm font-semibold text-stone-900">
                      <Tag className="h-5 w-5 text-stone-400" aria-hidden="true" />
                      {contact.tags?.length || 0} Tags
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

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
                          <select id="type" name="type" className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6">
                            <option value="donor">Donor</option>
                            <option value="grantor">Grantor</option>
                            <option value="sponsor">Sponsor</option>
                            <option value="volunteer">Volunteer</option>
                          </select>
                        </div>
                      </div>
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
    </div>
  );
}
