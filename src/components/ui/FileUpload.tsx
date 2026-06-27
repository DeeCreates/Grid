// src/components/ui/FileUpload.tsx
import { useState, useRef } from 'react';
import { Upload, X, File, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  label?: string;
}

export function FileUpload({ onUpload, accept, multiple, maxSize = 10, label }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    let errorMsg = null;

    for (const file of selectedFiles) {
      if (file.size > maxSize * 1024 * 1024) {
        errorMsg = `File ${file.name} exceeds ${maxSize}MB limit`;
        break;
      }
      validFiles.push(file);
    }

    if (errorMsg) {
      setError(errorMsg);
    } else {
      setFiles(validFiles);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    try {
      await onUpload(files);
      setSuccess(true);
      setFiles([]);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition',
          files.length > 0 ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">
          {files.length > 0 ? `${files.length} file(s) selected` : 'Click or drag files to upload'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Max file size: {maxSize}MB
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <File className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700">{file.name}</span>
                <span className="text-xs text-gray-400">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <button onClick={() => removeFile(index)} className="text-gray-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Files'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="w-4 h-4" />
          Files uploaded successfully!
        </div>
      )}
    </div>
  );
}