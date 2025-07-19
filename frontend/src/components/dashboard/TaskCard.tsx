import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Task } from '../../types';
import { TASK_TYPES } from '../../utils/constants';
import { formatFileSize } from '../../utils/validation';
import { Card } from '../common/Card';
import { ProgressBar } from '../common/ProgressBar';
import { Button } from '../common/Button';
import { iconMap } from '../../utils/iconMapping';
import { taskService } from '../../services/taskService';

interface TaskCardProps {
  task: Task;
  onDownload?: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onDownload }) => {
  const taskConfig = TASK_TYPES[task.type];
  const IconComponent = iconMap[taskConfig.icon];
  const [isStoppingDeployment, setIsStoppingDeployment] = useState(false);

  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle className="text-green-400" size={20} />;
      case 'failed':
        return <XCircle className="text-red-400" size={20} />;
      case 'processing':
        return <RefreshCw className="text-blue-400 animate-spin" size={20} />;
      default:
        return <Clock className="text-yellow-400" size={20} />;
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      case 'processing':
        return 'blue';
      default:
        return 'blue';
    }
  };

  const handleStopDeployment = async () => {
    if (!task.id || task.type !== 'github-deploy') return;

    setIsStoppingDeployment(true);
    try {
      await taskService.stopDeployment(task.id);
      // You might want to trigger a refresh of the task list here
    } catch (error) {
      console.error('Failed to stop deployment:', error);
    } finally {
      setIsStoppingDeployment(false);
    }
  };

  const renderGithubDeployInfo = () => {
    if (task.type !== 'github-deploy') return null;

    return (
      <div className="mt-4 space-y-2">
        {task.status === 'running' && task.publicUrl && (
          <div className="flex items-center space-x-2">
            <ExternalLink className="h-4 w-4 text-green-400" />
            <a
              href={task.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Open Application
            </a>
          </div>
        )}

        {task.status === 'running' && task.timeRemaining && (
          <div className="text-sm text-gray-400">
            Time remaining: {Math.floor(task.timeRemaining / (1000 * 60))} minutes
          </div>
        )}

        {task.status === 'running' && (
          <Button
            onClick={handleStopDeployment}
            disabled={isStoppingDeployment}
            variant="destructive"
            size="sm"
            className="mt-2"
          >
            {isStoppingDeployment ? 'Stopping...' : 'Stop Deployment'}
          </Button>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-blue-400">
              <IconComponent size={32} />
            </div>
            <div>
              <h3 className="font-medium text-white">{taskConfig.name}</h3>
              <p className="text-sm text-gray-400">{task.fileName}</p>
              <p className="text-xs text-gray-500">{formatFileSize(task.fileSize)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm text-gray-400 capitalize">{task.status}</span>
          </div>
        </div>

        {task.status === 'processing' && (
          <ProgressBar progress={task.progress} color={getStatusColor() as any} />
        )}

        {task.error && (
          <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
            <p className="text-red-400 text-sm">{task.error}</p>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
          {task.completedAt && (
            <span>Completed: {new Date(task.completedAt).toLocaleString()}</span>
          )}
        </div>

        {task.status === 'completed' && (
          <div className="flex space-x-2">
            {task.downloadUrl && onDownload && (
              <Button
                onClick={() => onDownload(task.id)}
                variant="secondary"
                size="sm"
                className="flex-1"
              >
                <Download size={16} className="mr-2" />
                Download
              </Button>
            )}
            {task.deploymentUrl && (
              <Button
                onClick={() => window.open(task.deploymentUrl, '_blank')}
                variant="primary"
                size="sm"
                className="flex-1"
              >
                <ExternalLink size={16} className="mr-2" />
                Open App
              </Button>
            )}
          </div>
        )}

        {renderGithubDeployInfo()}
      </Card>
    </motion.div>
  );
};
