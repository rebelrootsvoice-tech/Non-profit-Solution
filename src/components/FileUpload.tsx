import React, { useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { UploadCloud, X, File as FileIcon, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onUploadComplete: (url: string) => void;
  folder: string;
  defaultUrl?: string;
  label?: string;
}

export function FileUpload({ onUploadComplete, folder, defaultUrl, label = "Upload File" }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | undefined>(defaultUrl);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress(0);

    const fileRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(p);
      },
      (err) => {
        console.error('Upload failed:', err);
        setError('Upload failed. Please try again.');
        setUploading(false);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setCurrentUrl(url);
          onUploadComplete(url);
        } catch (err) {
          console.error('Failed to get download URL:', err);
          setError('Failed to retrieve file URL.');
        } finally {
          setUploading(false);
        }
      }
    );
  };

  const clearFile = () => {
    setCurrentUrl(undefined);
    onUploadComplete('');
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium leading-6 text-stone-900">{label}</label>
      <div className="mt-2 flex justify-center rounded-lg border border-dashed border-stone-900/25 px-6 py-4">
        {currentUrl ? (
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileIcon className="h-6 w-6 text-emerald-600" />
              <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-600 hover:text-emerald-500 truncate max-w-[200px] sm:max-w-xs">
                View Uploaded File
              </a>
            </div>
            <button
              type="button"
              onClick={clearFile}
              className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : uploading ? (
          <div className="flex w-full flex-col items-center justify-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <div className="w-full max-w-xs bg-stone-200 rounded-full h-1.5">
              <div className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-xs text-stone-500">{Math.round(progress)}% uploaded</p>
          </div>
        ) : (
          <div className="text-center">
            <UploadCloud className="mx-auto h-8 w-8 text-stone-300" aria-hidden="true" />
            <div className="mt-2 flex text-sm leading-6 text-stone-600 justify-center">
              <label
                htmlFor={`file-upload-${folder}`}
                className="relative cursor-pointer rounded-md bg-white font-semibold text-emerald-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-emerald-600 focus-within:ring-offset-2 hover:text-emerald-500"
              >
                <span>Upload a file</span>
                <input id={`file-upload-${folder}`} name="file-upload" type="file" className="sr-only" onChange={handleFileChange} />
              </label>
            </div>
            <p className="text-xs leading-5 text-stone-500">PDF, PNG, JPG, DOC up to 10MB</p>
          </div>
        )}
      </div>
    </div>
  );
}
