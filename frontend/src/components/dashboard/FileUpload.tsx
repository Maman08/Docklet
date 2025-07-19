import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, FileIcon } from 'lucide-react';
import { TaskType } from '../../types';
import { validateFile, formatFileSize } from '../../utils/validation';
import { TASK_TYPES } from '../../utils/constants';
import { Card } from '../common/Card';

interface FileUploadProps {
  taskType: TaskType;
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  taskType,
  onFileSelect,
  selectedFile
}) => {
  if (taskType === 'github-deploy') {
    return null;
  }
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const validation = validateFile(file, taskType);
      
      if (validation.valid) {
        onFileSelect(file);
      } else {
        setError(validation.error || 'Invalid file');
      }
    }
  }, [taskType, onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validation = validateFile(file, taskType);
      
      if (validation.valid) {
        onFileSelect(file);
      } else {
        setError(validation.error || 'Invalid file');
      }
    }
  }, [taskType, onFileSelect]);

  const removeFile = () => {
    onFileSelect(null as any);
    setError(null);
  };

  const taskConfig = TASK_TYPES[taskType];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-white">Upload File</h3>
      
      {selectedFile ? (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileIcon className="text-blue-400" size={24} />
              <div>
                <p className="text-white font-medium">{selectedFile.name}</p>
                <p className="text-gray-400 text-sm">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={removeFile}
              className="text-gray-400 hover:text-red-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </Card>
      ) : (
        <motion.div
          whileHover={{ scale: 1.01 }}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
            dragActive
              ? 'border-blue-400 bg-blue-400/10'
              : 'border-gray-600 hover:border-gray-500'
          } ${error ? 'border-red-400' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            onChange={handleChange}
            accept={taskConfig.supportedFormats.map(f => `.${f}`).join(',')}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          <Upload className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-white mb-2">Drop your file here or click to browse</p>
          <p className="text-gray-400 text-sm">
            Supported formats: {taskConfig.supportedFormats.join(', ')}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Maximum size: {Math.round(taskConfig.maxSize / (1024 * 1024))}MB
          </p>
        </motion.div>
      )}

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
};