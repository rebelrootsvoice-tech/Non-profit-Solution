import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, setDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { CheckSquare, Plus, Clock } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: any;
  status: string;
  module: string;
}

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'tasks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData: Task[] = [];
      snapshot.forEach((doc) => {
        tasksData.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(tasksData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching tasks:", err);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleAddTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      setError(null);
      const newDocRef = doc(collection(db, 'tasks'));
      await setDoc(newDocRef, {
        id: newDocRef.id,
        title: formData.get('title') || '',
        description: formData.get('description') || '',
        assignedTo: user?.uid || '',
        dueDate: formData.get('dueDate') || '',
        status: 'todo',
        module: formData.get('module') || 'donors',
        relatedRecordId: '',
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
    } catch (err) {
      console.error("Error adding task:", err);
      setError("Failed to add task. Check permissions.");
      setTimeout(() => setError(null), 5000);
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      setError(null);
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus
      });
    } catch (err) {
      console.error("Error updating task:", err);
      setError("Failed to update task status.");
      setTimeout(() => setError(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between border-b border-stone-200 pb-5">
        <div>
          <h3 className="text-2xl font-semibold leading-6 text-stone-900">Tasks</h3>
          <p className="mt-2 text-sm text-stone-500">
            Manage tasks across all modules.
          </p>
        </div>
        <div className="mt-4 sm:ml-4 sm:mt-0">
          <button
            onClick={() => setShowAddModal(true)}
            type="button"
            className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            New Task
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <h3 className="text-sm font-medium text-red-800">{error}</h3>
        </div>
      )}

      <div className="bg-white shadow-sm ring-1 ring-stone-200 sm:rounded-xl">
        <ul role="list" className="divide-y divide-stone-200">
          {loading ? (
            <li className="p-6 text-stone-500">Loading tasks...</li>
          ) : tasks.length === 0 ? (
            <li className="p-6 text-stone-500">No tasks found.</li>
          ) : (
            tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-x-6 px-4 py-5 hover:bg-stone-50 sm:px-6">
                <div className="flex min-w-0 gap-x-4 items-center">
                  <button 
                    onClick={() => toggleTaskStatus(task.id, task.status)}
                    className={`h-6 w-6 rounded border flex items-center justify-center ${
                      task.status === 'done' 
                        ? 'bg-emerald-600 border-emerald-600 text-white' 
                        : 'border-stone-300 text-transparent hover:border-emerald-500'
                    }`}
                  >
                    <CheckSquare className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-auto">
                    <p className={`text-sm font-semibold leading-6 ${task.status === 'done' ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                      {task.title}
                    </p>
                    <p className="mt-1 flex text-xs leading-5 text-stone-500">
                      <span className="truncate">{task.description}</span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-x-4">
                  <div className="hidden sm:flex sm:flex-col sm:items-end">
                    <p className="text-sm leading-6 text-stone-900 capitalize">{task.module}</p>
                    {task.dueDate && (
                      <p className="mt-1 text-xs leading-5 text-stone-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Due {task.dueDate}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-stone-500 bg-opacity-75 transition-opacity"></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <form onSubmit={handleAddTask}>
                  <div>
                    <h3 className="text-base font-semibold leading-6 text-stone-900" id="modal-title">Add New Task</h3>
                    <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                      <div className="sm:col-span-2">
                        <label htmlFor="title" className="block text-sm font-medium leading-6 text-stone-900">Task Title</label>
                        <div className="mt-2">
                          <input type="text" name="title" id="title" required className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="description" className="block text-sm font-medium leading-6 text-stone-900">Description</label>
                        <div className="mt-2">
                          <textarea id="description" name="description" rows={3} className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="dueDate" className="block text-sm font-medium leading-6 text-stone-900">Due Date</label>
                        <div className="mt-2">
                          <input type="date" name="dueDate" id="dueDate" className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="module" className="block text-sm font-medium leading-6 text-stone-900">Module</label>
                        <div className="mt-2">
                          <select id="module" name="module" className="block w-full rounded-md border-0 py-1.5 text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6">
                            <option value="donors">Donors & Grants</option>
                            <option value="compliance">Compliance</option>
                            <option value="bookkeeping">Bookkeeping</option>
                            <option value="board">Board Management</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button type="submit" className="inline-flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:col-start-2">
                      Save Task
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
