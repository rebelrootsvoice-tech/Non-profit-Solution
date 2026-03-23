import React, { useState, useEffect, useId } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { UploadCloud, X, File as FileIcon, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onUploadComplete: (url: string) => void;
  onFileSelect?: (file: File) => void;
  onUploadingChange?: (uploading: boolean) => void;
  folder: string;
  defaultUrl?: string;
  label?: string;
}

export function FileUpload({ onUploadComplete, onFileSelect, onUploadingChange, folder, defaultUrl, label = "Upload File" }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | undefined>(defaultUrl);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const inputId = useId();

  // Sync with defaultUrl if it changes from outside
  useEffect(() => {
    setCurrentUrl(defaultUrl);
    if (!defaultUrl) setLocalPreview(null);
  }, [defaultUrl]);

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (onFileSelect) {
      onFileSelect(file);
    }

    // Create local preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setLocalPreview(null);
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    const startUpload = (fileToUpload: File) => {
      try {
        const fileRef = ref(storage, `${folder}/${Date.now()}_${fileToUpload.name}`);
        const uploadTask = uploadBytesResumable(fileRef, fileToUpload);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(p);
          },
          (err) => {
            console.error('Upload failed:', err);
            setError(`Upload failed: ${err.message || 'Check permissions or connection'}`);
            setUploading(false);
          },
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              setCurrentUrl(url);
              onUploadComplete(url);
              setLocalPreview(null);
            } catch (err: any) {
              console.error('Failed to get download URL:', err);
              setError(`Failed to retrieve file URL: ${err.message || 'Unknown error'}`);
            } finally {
              setUploading(false);
            }
          }
        );
      } catch (err: any) {
        console.error('Upload failed to start:', err);
        setError(`Upload could not start: ${err.message || 'Check connection'}`);
        setUploading(false);
      }
    };

    startUpload(file);
  };

  const clearFile = () => {
    setCurrentUrl(undefined);
    setLocalPreview(null);
    onUploadComplete('');
  };

  const isImage = (url: string) => {
    if (!url) return false;
    // Check for common image extensions or Firebase Storage image metadata
    return url.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)$/i) !== null || 
           url.includes('image%2F') || 
           url.includes('image/') ||
           url.startsWith('data:image/');
  };

  const displayUrl = localPreview || currentUrl;

  return (
    <div className="w-full">
      <label className="block text-sm font-medium leading-6 text-stone-900">{label}</label>
      <div className="mt-2 flex justify-center rounded-lg border border-dashed border-stone-900/25 px-6 py-4">
        {displayUrl ? (
          <div className="flex w-full flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileIcon className="h-6 w-6 text-emerald-600" />
                <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-600 hover:text-emerald-500 truncate max-w-[200px] sm:max-w-xs">
                  {localPreview ? 'Previewing Local File...' : 'View Uploaded File'}
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
            {isImage(displayUrl) && (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-stone-100 border border-stone-200">
                <img 
                  src={displayUrl} 
                  alt="Receipt Preview" 
                  className="h-full w-full object-contain"
                  referrerPolicy="no-referrer"
                />
                {uploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[1px]">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                    <p className="mt-2 text-xs font-medium text-white drop-shadow-md">{Math.round(progress)}%</p>
                  </div>
                )}
              </div>
            )}
            {error && (
              <div className="flex flex-col items-center space-y-2">
                <p className="text-xs text-red-600 text-center">{error}</p>
                <button 
                  type="button" 
                  onClick={() => {
                    const input = document.getElementById(inputId) as HTMLInputElement;
                    if (input?.files?.[0]) {
                      handleFileChange({ target: { files: input.files } } as any);
                    }
                  }}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 underline"
                >
                  Retry Upload
                </button>
              </div>
            )}
            {uploading && !isImage(displayUrl) && (
              <div className="flex w-full flex-col items-center justify-center space-y-3 py-4">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                <div className="w-full max-w-xs bg-stone-200 rounded-full h-1.5">
                  <div className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-xs text-stone-500">{Math.round(progress)}% uploaded</p>
              </div>
            )}
          </div>
        ) : uploading ? (
          <div className="flex w-full flex-col items-center justify-center space-y-3 py-4">
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
                htmlFor={inputId}
                className="relative cursor-pointer rounded-md bg-white font-semibold text-emerald-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-emerald-600 focus-within:ring-offset-2 hover:text-emerald-500"
              >
                <span>Upload a file</span>
                <input id={inputId} name="file-upload" type="file" className="sr-only" onChange={handleFileChange} />
              </label>
            </div>
            <p className="text-xs leading-5 text-stone-500">PDF, PNG, JPG, DOC up to 10MB</p>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
