import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TaskType, TaskParameters, Task } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { taskService } from '../services/taskService';
import { Header } from '../components/layout/Header';
import { TaskTypeSelector } from '../components/dashboard/TaskTypeSelector';
import { FileUpload } from '../components/dashboard/FileUpload';
import { TaskParametersComponent } from '../components/dashboard/TaskParameters';
import { TaskCard } from '../components/dashboard/TaskCard';
import { CodeEditor } from '../components/dashboard/CodeEditor';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { CODE_LANGUAGES } from '../utils/constants';
import toast from 'react-hot-toast';

const baseClasses = `
  relative 
  bg-blue/10 
  backdrop-blur-lg 
  border border-white/20 
  rounded-2xl 
  p-6 
  shadow-[inset_0_1px_0_#ffffff20,_0_4px_30px_rgba(0,0,0,0.1)] 
  before:absolute before:inset-0 before:bg-gradient-to-br 
  before:from-white/10 before:to-transparent 
  before:z-[-1] 
  overflow-hidden
`;

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<TaskType | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parameters, setParameters] = useState<TaskParameters>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'code' | 'tasks'>('upload');
  
  // Code editor state
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [codeOutput, setCodeOutput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserTasks();
    }
  }, [user]);

  useEffect(() => {
    // Set default code template when language changes
    const languageConfig = CODE_LANGUAGES[language as keyof typeof CODE_LANGUAGES];
    if (languageConfig) {
      setCode(languageConfig.template);
    }
  }, [language]);

  const loadUserTasks = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const userTasks = await taskService.getUserTasks(user.id);
      setTasks(userTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskSubmit = async () => {
    if (!selectedType || !selectedFile) {
      toast.error('Please select a task type and file');
      return;
    }

    setSubmitting(true);
    try {
      const result = await taskService.submitTask({
        type: selectedType,
        file: selectedFile,
        parameters
      });
      
      toast.success(`Task submitted successfully! ${result.estimatedTime ? `Estimated time: ${result.estimatedTime}s` : ''}`);
      setSelectedType(null);
      setSelectedFile(null);
      setParameters({});
      
      // Poll for task updates
      pollTaskStatus(result.taskId);
      
    } catch (error: any) {
      console.error('Task submission failed:', error);
      const errorMessage = error.response?.data?.error || 'Failed to submit task';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeExecute = async () => {
    if (!code.trim()) {
      toast.error('Please enter some code');
      return;
    }

    setExecuting(true);
    setCodeOutput('');
    setCodeError('');

    try {
      // Create a virtual file for code execution
      const codeBlob = new Blob([code], { type: 'text/plain' });
      const codeFile = new File([codeBlob], `script.${CODE_LANGUAGES[language as keyof typeof CODE_LANGUAGES]?.extension || 'txt'}`, { type: 'text/plain' });

      const result = await taskService.submitTask({
        type: 'code-execute',
        file: codeFile,
        parameters: {
          language,
          timeout: parameters.timeout || 30,
          memoryLimit: parameters.memoryLimit || '512MB'
        }
      });

      // Poll for execution results
      pollCodeExecution(result.taskId);
      
    } catch (error: any) {
      console.error('Code execution failed:', error);
      const errorMessage = error.response?.data?.error || 'Failed to execute code';
      setCodeError(errorMessage);
      setExecuting(false);
    }
  };

  const pollTaskStatus = async (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const task = await taskService.getTaskStatus(taskId);
        
        setTasks(prev => {
          const existing = prev.find(t => t.id === task.id);
          if (existing) {
            return prev.map(t => t.id === task.id ? task : t);
          } else {
            return [task, ...prev];
          }
        });

        if (task.status === 'completed' || task.status === 'failed') {
          clearInterval(interval);
          if (task.status === 'completed') {
            toast.success('Task completed successfully!');
          } else {
            toast.error(`Task failed: ${task.error || 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error('Error polling task status:', error);
        clearInterval(interval);
      }
    }, 2000);

    // Clear interval after 5 minutes to prevent infinite polling
    setTimeout(() => {
      clearInterval(interval);
    }, 300000);
  };

  const pollCodeExecution = async (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const task = await taskService.getTaskStatus(taskId);
        
        if (task.status === 'completed') {
          clearInterval(interval);
          setExecuting(false);
          // For code execution, show output from task results
          setCodeOutput(task.output || 'Code executed successfully!');
        } else if (task.status === 'failed') {
          clearInterval(interval);
          setExecuting(false);
          setCodeError(task.error || 'Execution failed');
        }
      } catch (error) {
        console.error('Error polling code execution:', error);
        clearInterval(interval);
        setExecuting(false);
        setCodeError('Failed to get execution results');
      }
    }, 1000);

    // Clear interval after 2 minutes for code execution
    setTimeout(() => {
      clearInterval(interval);
      if (executing) {
        setExecuting(false);
        setCodeError('Execution timeout');
      }
    }, 120000);
  };

  const handleDownload = async (taskId: string) => {
    try {
      await taskService.downloadFile(taskId);
      toast.success('File download started!');
    } catch (error: any) {
      console.error('Download failed:', error);
      const errorMessage = error.response?.data?.error || 'Failed to download file';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-white">
              Welcome to <span className="bg-gradient-to-r from-blue-400 to-black-400 bg-clip-text text-transparent">Docklet</span>
            </h1>
            <p className="text-gray-400 text-lg">Process files with Docker power</p>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center">
            <div className="bg-gray-800/50 rounded-lg p-1 flex space-x-1">
              {[
                { id: 'upload', label: 'File Processing' },
                { id: 'code', label: 'Code Execution' },
                { id: 'tasks', label: 'My Tasks' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {activeTab === 'upload' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <TaskTypeSelector
                  selectedType={selectedType}
                  onTypeSelect={setSelectedType}
                />
                
                {selectedType && (
                  <>
                    <FileUpload
                      taskType={selectedType}
                      onFileSelect={setSelectedFile}
                      selectedFile={selectedFile}
                    />
                    
                    <TaskParametersComponent
                      taskType={selectedType}
                      parameters={parameters}
                      onParametersChange={setParameters}
                    />
                  </>
                )}
              </div>
              
              <div className="space-y-6">
                <Card>
                  <h3 className="text-lg font-medium text-white mb-4">Submit Task</h3>
                  <div className="space-y-4">
                    <div className="text-sm text-gray-400">
                      {selectedType ? (
                        <>
                          <p>✓ Task type selected: {selectedType}</p>
                          {selectedFile && <p>✓ File uploaded: {selectedFile.name}</p>}
                        </>
                      ) : (
                        <p>Select a task type to continue</p>
                      )}
                    </div>
                    
                    <Button
                      onClick={handleTaskSubmit}
                      disabled={!selectedType || !selectedFile}
                      loading={submitting}
                      className="w-full"
                    >
                      Submit Task
                    </Button>
                  </div>
                </Card>
                
                {/* Quick Stats */}
                <Card>
                  <h3 className="text-lg font-medium text-white mb-4">Quick Stats</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Tasks:</span>
                      <span className="text-white">{tasks.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Completed:</span>
                      <span className="text-green-400">{tasks.filter(t => t.status === 'completed').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Processing:</span>
                      <span className="text-blue-400">{tasks.filter(t => t.status === 'processing').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Failed:</span>
                      <span className="text-red-400">{tasks.filter(t => t.status === 'failed').length}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="max-w-4xl mx-auto">
              <CodeEditor
                language={language}
                code={code}
                onCodeChange={setCode}
                onLanguageChange={setLanguage}
                onExecute={handleCodeExecute}
                executing={executing}
                output={codeOutput}
                error={codeError}
              />
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-white">My Tasks</h2>
                <Button onClick={loadUserTasks} variant="secondary" disabled={loading}>
                  {loading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
              
              {loading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : tasks.length === 0 ? (
                <Card className="text-center py-12">
                  <p className="text-gray-400">No tasks found. Submit your first task to get started!</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onDownload={handleDownload}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};