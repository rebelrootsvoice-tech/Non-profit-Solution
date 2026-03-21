import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { collection, onSnapshot, query, doc, setDoc, orderBy } from 'firebase/firestore';
import { 
  Users, 
  FileText, 
  Briefcase, 
  Plus, 
  Search, 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Video
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FileUpload } from './components/FileUpload';

interface BoardMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'candidate' | 'active' | 'former';
  resumeUrl: string;
  specialties: string[];
  experiences: string;
  onboardingProgress: number;
  joinedDate: string;
  createdAt: string;
}

interface BoardMeetingMinute {
  id: string;
  date: string;
  title: string;
  content: string;
  source: 'manual' | 'zoom_ai';
  createdAt: string;
}

interface BoardProject {
  id: string;
  title: string;
  description: string;
  leadMemberId: string;
  phase: 'planning' | 'active' | 'completed' | 'failed';
  team: string[];
  budget: number;
  resources: string;
  supplies: string;
  proposalsPassed: string[];
  createdAt: string;
}

export function Board() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<'members' | 'minutes' | 'projects'>('members');
  
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [minutes, setMinutes] = useState<BoardMeetingMinute[]>([]);
  const [projects, setProjects] = useState<BoardProject[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showMinuteModal, setShowMinuteModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showViewMinuteModal, setShowViewMinuteModal] = useState(false);
  const [selectedMinute, setSelectedMinute] = useState<BoardMeetingMinute | null>(null);
  const [editingMember, setEditingMember] = useState<BoardMember | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string>('');
  const [isSyncingZoom, setIsSyncingZoom] = useState(false);

  useEffect(() => {
    if (editingMember) {
      setResumeUrl(editingMember.resumeUrl || '');
    } else {
      setResumeUrl('');
    }
  }, [editingMember]);

  useEffect(() => {
    const unsubMembers = onSnapshot(query(collection(db, 'boardMembers')), (snapshot) => {
      setMembers(snapshot.docs.map(doc => doc.data() as BoardMember));
    });
    
    const unsubMinutes = onSnapshot(query(collection(db, 'boardMinutes'), orderBy('date', 'desc')), (snapshot) => {
      setMinutes(snapshot.docs.map(doc => doc.data() as BoardMeetingMinute));
    });

    const unsubProjects = onSnapshot(query(collection(db, 'boardProjects')), (snapshot) => {
      setProjects(snapshot.docs.map(doc => doc.data() as BoardProject));
    });

    setLoading(false);
    return () => {
      unsubMembers();
      unsubMinutes();
      unsubProjects();
    };
  }, []);

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const specialties = (formData.get('specialties') as string).split(',').map(s => s.trim()).filter(Boolean);
    
    try {
      const newRef = editingMember ? doc(db, 'boardMembers', editingMember.id) : doc(collection(db, 'boardMembers'));
      await setDoc(newRef, {
        id: newRef.id,
        name: formData.get('name') || '',
        email: formData.get('email') || '',
        phone: formData.get('phone') || '',
        status: formData.get('status') || 'candidate',
        resumeUrl: resumeUrl || '',
        specialties,
        experiences: formData.get('experiences') || '',
        onboardingProgress: parseInt(formData.get('onboardingProgress') as string) || 0,
        joinedDate: editingMember ? editingMember.joinedDate : (formData.get('joinedDate') || new Date().toISOString()),
        createdAt: editingMember ? editingMember.createdAt : new Date().toISOString()
      }, { merge: true });
      setShowMemberModal(false);
      setEditingMember(null);
    } catch (error) {
      console.error("Error adding member:", error);
      alert("Failed to add member.");
    }
  };

  const handleAddMinute = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const newRef = doc(collection(db, 'boardMinutes'));
      await setDoc(newRef, {
        id: newRef.id,
        date: formData.get('date') || new Date().toISOString(),
        title: formData.get('title') || '',
        content: formData.get('content') || '',
        source: 'manual',
        createdAt: new Date().toISOString()
      });
      setShowMinuteModal(false);
    } catch (error) {
      console.error("Error adding minute:", error);
      alert("Failed to add minute.");
    }
  };

  const handleAddProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const team = (formData.get('team') as string).split(',').map(s => s.trim()).filter(Boolean);
    const proposalsPassed = (formData.get('proposalsPassed') as string).split(',').map(s => s.trim()).filter(Boolean);
    
    try {
      const newRef = doc(collection(db, 'boardProjects'));
      await setDoc(newRef, {
        id: newRef.id,
        title: formData.get('title') || '',
        description: formData.get('description') || '',
        leadMemberId: formData.get('leadMemberId') || '',
        phase: formData.get('phase') || 'planning',
        team,
        budget: parseFloat(formData.get('budget') as string) || 0,
        resources: formData.get('resources') || '',
        supplies: formData.get('supplies') || '',
        proposalsPassed,
        createdAt: new Date().toISOString()
      });
      setShowProjectModal(false);
    } catch (error) {
      console.error("Error adding project:", error);
      alert("Failed to add project.");
    }
  };

  const handleSyncZoomMinutes = async () => {
    setIsSyncingZoom(true);
    try {
      const response = await fetch('/api/webhooks/zoom/pending');
      if (!response.ok) throw new Error('Failed to fetch pending minutes');
      const data = await response.json();
      
      if (data.minutes && data.minutes.length > 0) {
        let addedCount = 0;
        for (const minute of data.minutes) {
          const newRef = doc(collection(db, 'boardMinutes'));
          await setDoc(newRef, {
            id: newRef.id,
            date: minute.date || minute.receivedAt || new Date().toISOString(),
            title: minute.title || 'Zoom Meeting Minutes',
            content: minute.content || JSON.stringify(minute, null, 2),
            source: 'zoom_ai',
            createdAt: new Date().toISOString()
          });
          addedCount++;
        }
        
        // Clear pending minutes after successful sync
        await fetch('/api/webhooks/zoom/pending', { method: 'DELETE' });
        alert(`Successfully synced ${addedCount} meeting minute(s) from Zoom.`);
      } else {
        alert('No new meeting minutes found from Zoom.');
      }
    } catch (error) {
      console.error('Error syncing Zoom minutes:', error);
      alert('Failed to sync Zoom minutes. Please try again.');
    } finally {
      setIsSyncingZoom(false);
    }
  };

  const tabs = [
    { id: 'members', name: 'Members & Recruitment', icon: Users },
    { id: 'minutes', name: 'Meeting Minutes', icon: FileText },
    { id: 'projects', name: 'Projects & Proposals', icon: Briefcase },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between border-b border-stone-200 pb-5">
        <div>
          <h3 className="text-2xl font-semibold leading-6 text-stone-900">Board Governance</h3>
          <p className="mt-2 text-sm text-stone-500">
            Manage board members, meeting minutes, and strategic projects.
          </p>
        </div>
        <div className="mt-4 sm:ml-4 sm:mt-0 flex gap-3">
          {(role === 'admin' || role === 'staff' || role === 'board') && (
            <>
              {activeTab === 'members' && (
                <button onClick={() => { setEditingMember(null); setShowMemberModal(true); }} className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
                  <Plus className="-ml-0.5 mr-1.5 h-5 w-5" /> Add Member
                </button>
              )}
              {activeTab === 'minutes' && (
                <button onClick={() => setShowMinuteModal(true)} className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
                  <Plus className="-ml-0.5 mr-1.5 h-5 w-5" /> Add Minutes
                </button>
              )}
              {activeTab === 'projects' && (
                <button onClick={() => setShowProjectModal(true)} className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
                  <Plus className="-ml-0.5 mr-1.5 h-5 w-5" /> Add Project
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="border-b border-stone-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={twMerge(
                clsx(
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700',
                  'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium'
                )
              )}
            >
              <tab.icon
                className={twMerge(
                  clsx(
                    activeTab === tab.id ? 'text-emerald-500' : 'text-stone-400 group-hover:text-stone-500',
                    '-ml-0.5 mr-2 h-5 w-5'
                  )
                )}
                aria-hidden="true"
              />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {loading ? (
          <p className="text-stone-500">Loading...</p>
        ) : (
          <>
            {activeTab === 'members' && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {members.map(member => (
                  <div key={member.id} className="col-span-1 divide-y divide-stone-200 rounded-xl bg-white shadow-sm border border-stone-200">
                    <div className="flex w-full items-center justify-between space-x-6 p-6">
                      <div className="flex-1 truncate">
                        <div className="flex items-center space-x-3">
                          <h3 className="truncate text-sm font-medium text-stone-900">{member.name}</h3>
                          <span className={twMerge(
                            clsx(
                              "inline-flex flex-shrink-0 items-center rounded-full px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                              member.status === 'active' ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" :
                              member.status === 'candidate' ? "bg-blue-50 text-blue-700 ring-blue-600/20" :
                              "bg-stone-50 text-stone-700 ring-stone-600/20"
                            )
                          )}>
                            {member.status}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-stone-500">{member.email}</p>
                        <div className="mt-4">
                          <div className="flex justify-between text-xs text-stone-500 mb-1">
                            <span>Onboarding</span>
                            <span>{member.onboardingProgress}%</span>
                          </div>
                          <div className="w-full bg-stone-200 rounded-full h-1.5">
                            <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${member.onboardingProgress}%` }}></div>
                          </div>
                        </div>
                        {member.specialties.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-1">
                            {member.specialties.map(s => (
                              <span key={s} className="inline-flex items-center rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                        {member.experiences && (
                          <p className="mt-3 text-xs text-stone-500 line-clamp-2" title={member.experiences}>
                            <span className="font-medium text-stone-700">Experience:</span> {member.experiences}
                          </p>
                        )}
                        {member.resumeUrl && (
                          <div className="mt-4 pt-4 border-t border-stone-100 flex justify-between items-center">
                            <a 
                              href={member.resumeUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View Resume
                            </a>
                            <button 
                              onClick={() => { setEditingMember(member); setShowMemberModal(true); }}
                              className="text-xs font-medium text-stone-500 hover:text-stone-700"
                            >
                              Edit Profile
                            </button>
                          </div>
                        )}
                        {!member.resumeUrl && (
                          <div className="mt-4 pt-4 border-t border-stone-100 flex justify-end items-center">
                            <button 
                              onClick={() => { setEditingMember(member); setShowMemberModal(true); }}
                              className="text-xs font-medium text-stone-500 hover:text-stone-700"
                            >
                              Edit Profile
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {members.length === 0 && <p className="text-stone-500 col-span-full">No members found.</p>}
              </div>
            )}

            {activeTab === 'minutes' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Video className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Zoom AI Assistant Integration</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        To automatically sync meeting minutes from Zoom, configure your Zoom AI Assistant to send a webhook POST request to:
                        <br />
                        <code className="bg-blue-100 px-2 py-1 rounded mt-2 inline-block text-xs">{window.location.origin}/api/webhooks/zoom</code>
                      </p>
                    </div>
                  </div>
                  {(role === 'admin' || role === 'staff' || role === 'board') && (
                    <button 
                      onClick={handleSyncZoomMinutes}
                      disabled={isSyncingZoom}
                      className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                    >
                      {isSyncingZoom ? 'Syncing...' : 'Sync Zoom Minutes'}
                    </button>
                  )}
                </div>
                
                <div className="overflow-hidden bg-white shadow-sm ring-1 ring-stone-300 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-stone-300">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-stone-900">Date</th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-stone-900">Title</th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-stone-900">Source</th>
                        <th className="px-3 py-3.5 text-right text-sm font-semibold text-stone-900">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 bg-white">
                      {minutes.map((minute) => (
                        <tr key={minute.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-stone-900">
                            {new Date(minute.date).toLocaleDateString()}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-stone-500">{minute.title}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-stone-500">
                            <span className={twMerge(
                              clsx(
                                "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                                minute.source === 'zoom_ai' ? "bg-blue-50 text-blue-700 ring-blue-600/20" : "bg-stone-50 text-stone-600 ring-stone-500/10"
                              )
                            )}>
                              {minute.source === 'zoom_ai' ? 'Zoom AI' : 'Manual'}
                            </span>
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium">
                            <button 
                              onClick={() => { setSelectedMinute(minute); setShowViewMinuteModal(true); }}
                              className="text-emerald-600 hover:text-emerald-900"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                      {minutes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-stone-500">No meeting minutes found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {projects.map(project => (
                  <div key={project.id} className="bg-white overflow-hidden shadow-sm rounded-xl border border-stone-200">
                    <div className="px-4 py-5 sm:px-6 border-b border-stone-200 flex justify-between items-start">
                      <div>
                        <h3 className="text-lg leading-6 font-medium text-stone-900">{project.title}</h3>
                        <p className="mt-1 max-w-2xl text-sm text-stone-500">{project.description}</p>
                      </div>
                      <span className={twMerge(
                        clsx(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          project.phase === 'completed' ? "bg-emerald-100 text-emerald-800" :
                          project.phase === 'active' ? "bg-blue-100 text-blue-800" :
                          project.phase === 'failed' ? "bg-red-100 text-red-800" :
                          "bg-stone-100 text-stone-800"
                        )
                      )}>
                        {project.phase}
                      </span>
                    </div>
                    <div className="px-4 py-5 sm:p-6">
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-stone-500">Lead Member</dt>
                          <dd className="mt-1 text-sm text-stone-900">
                            {members.find(m => m.id === project.leadMemberId)?.name || 'Unknown'}
                          </dd>
                        </div>
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-stone-500">Budget</dt>
                          <dd className="mt-1 text-sm text-stone-900">${project.budget.toLocaleString()}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-sm font-medium text-stone-500">Team</dt>
                          <dd className="mt-1 text-sm text-stone-900">{project.team.join(', ') || 'None'}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-sm font-medium text-stone-500">Resources & Supplies</dt>
                          <dd className="mt-1 text-sm text-stone-900">
                            <ul className="list-disc pl-5 space-y-1">
                              {project.resources && <li>{project.resources}</li>}
                              {project.supplies && <li>{project.supplies}</li>}
                            </ul>
                          </dd>
                        </div>
                        {project.proposalsPassed.length > 0 && (
                          <div className="sm:col-span-2">
                            <dt className="text-sm font-medium text-stone-500">Passed Proposals</dt>
                            <dd className="mt-1 text-sm text-stone-900">
                              <ul className="list-disc pl-5 space-y-1">
                                {project.proposalsPassed.map((p, i) => <li key={i}>{p}</li>)}
                              </ul>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>
                ))}
                {projects.length === 0 && <p className="text-stone-500 col-span-full">No projects found.</p>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showMemberModal && (
        <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-stone-500 bg-opacity-75 transition-opacity"></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <form onSubmit={handleAddMember}>
                  <div>
                    <h3 className="text-base font-semibold leading-6 text-stone-900" id="modal-title">
                      {editingMember ? 'Edit Board Member' : 'Add Board Member / Candidate'}
                    </h3>
                    <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium leading-6 text-stone-900">Name</label>
                        <input type="text" name="name" defaultValue={editingMember?.name} required className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium leading-6 text-stone-900">Email</label>
                        <input type="email" name="email" defaultValue={editingMember?.email} className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium leading-6 text-stone-900">Phone</label>
                        <input type="tel" name="phone" defaultValue={editingMember?.phone} className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium leading-6 text-stone-900">Status</label>
                        <select name="status" defaultValue={editingMember?.status || 'candidate'} className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm">
                          <option value="candidate">Candidate</option>
                          <option value="active">Active</option>
                          <option value="former">Former</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium leading-6 text-stone-900">Onboarding Progress (%)</label>
                        <input type="number" name="onboardingProgress" min="0" max="100" defaultValue={editingMember?.onboardingProgress || 0} className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium leading-6 text-stone-900">Specialties (comma separated)</label>
                        <input type="text" name="specialties" defaultValue={editingMember?.specialties?.join(', ')} placeholder="e.g. Finance, Legal, Marketing" className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium leading-6 text-stone-900">Relevant Experience</label>
                        <textarea name="experiences" rows={3} defaultValue={editingMember?.experiences} className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <FileUpload 
                          folder="resumes" 
                          label="Resume (PDF, DOCX)" 
                          defaultUrl={resumeUrl} 
                          onUploadComplete={setResumeUrl} 
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button type="submit" className="inline-flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 sm:col-start-2">Save</button>
                    <button type="button" onClick={() => { setShowMemberModal(false); setEditingMember(null); }} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50 sm:col-start-1 sm:mt-0">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMinuteModal && (
        <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-stone-500 bg-opacity-75 transition-opacity"></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <form onSubmit={handleAddMinute}>
                  <div>
                    <h3 className="text-base font-semibold leading-6 text-stone-900" id="modal-title">Upload Meeting Minutes</h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium leading-6 text-stone-900">Date</label>
                        <input type="date" name="date" required className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium leading-6 text-stone-900">Title</label>
                        <input type="text" name="title" required placeholder="e.g. Q3 Board Meeting" className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium leading-6 text-stone-900">Content / Notes</label>
                        <textarea name="content" rows={5} required className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button type="submit" className="inline-flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 sm:col-start-2">Save</button>
                    <button type="button" onClick={() => setShowMinuteModal(false)} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50 sm:col-start-1 sm:mt-0">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {showViewMinuteModal && selectedMinute && (
        <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-stone-500 bg-opacity-75 transition-opacity"></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold leading-6 text-stone-900" id="modal-title">
                      {selectedMinute.title}
                    </h3>
                    <span className={twMerge(
                      clsx(
                        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                        selectedMinute.source === 'zoom_ai' ? "bg-blue-50 text-blue-700 ring-blue-600/20" : "bg-stone-50 text-stone-600 ring-stone-500/10"
                      )
                    )}>
                      {selectedMinute.source === 'zoom_ai' ? 'Zoom AI' : 'Manual'}
                    </span>
                  </div>
                  <p className="text-sm text-stone-500 mt-1">
                    Date: {new Date(selectedMinute.date).toLocaleDateString()}
                  </p>
                  <div className="mt-4 bg-stone-50 p-4 rounded-md border border-stone-200 max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-stone-800 font-sans">
                      {selectedMinute.content}
                    </pre>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6">
                  <button 
                    type="button" 
                    onClick={() => { setShowViewMinuteModal(false); setSelectedMinute(null); }} 
                    className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProjectModal && (
        <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-stone-500 bg-opacity-75 transition-opacity"></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <form onSubmit={handleAddProject}>
                  <div>
                    <h3 className="text-base font-semibold leading-6 text-stone-900" id="modal-title">Add Board Project</h3>
                    <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium leading-6 text-stone-900">Title</label>
                        <input type="text" name="title" required className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium leading-6 text-stone-900">Description</label>
                        <textarea name="description" rows={2} className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium leading-6 text-stone-900">Lead Member</label>
                        <select name="leadMemberId" className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm">
                          <option value="">Select Member...</option>
                          {members.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium leading-6 text-stone-900">Phase</label>
                        <select name="phase" className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm">
                          <option value="planning">Planning</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="failed">Failed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium leading-6 text-stone-900">Budget ($)</label>
                        <input type="number" name="budget" min="0" step="0.01" defaultValue="0" className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium leading-6 text-stone-900">Team Members (comma separated)</label>
                        <input type="text" name="team" placeholder="John, Sarah, Mike" className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium leading-6 text-stone-900">Resources Needed</label>
                        <input type="text" name="resources" className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium leading-6 text-stone-900">Supplies</label>
                        <input type="text" name="supplies" className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium leading-6 text-stone-900">Proposals Passed (comma separated)</label>
                        <input type="text" name="proposalsPassed" placeholder="Proposal A, Proposal B" className="mt-2 block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-emerald-600 sm:text-sm" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button type="submit" className="inline-flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 sm:col-start-2">Save</button>
                    <button type="button" onClick={() => setShowProjectModal(false)} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50 sm:col-start-1 sm:mt-0">Cancel</button>
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
