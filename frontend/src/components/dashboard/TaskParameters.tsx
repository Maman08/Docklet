import React from 'react';
import { TaskType, TaskParameters } from '../../types';
import { Input } from '../common/Input';
import { CODE_LANGUAGES, APP_TYPES } from '../../utils/constants';
import { Card } from '../common/Card';

interface TaskParametersProps {
  taskType: TaskType;
  parameters: TaskParameters;
  onParametersChange: (parameters: TaskParameters) => void;
}

export const TaskParametersComponent: React.FC<TaskParametersProps> = ({
  taskType,
  parameters,
  onParametersChange
}) => {
  const updateParameter = (key: string, value: any) => {
    onParametersChange({
      ...parameters,
      [key]: value
    });
  };

  const renderParameters = () => {
    switch (taskType) {
      case 'image-convert':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Output Format
              </label>
              <select
                value={parameters.format || 'png'}
                onChange={(e) => updateParameter('format', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="gif">GIF</option>
                <option value="webp">WebP</option>
                <option value="bmp">BMP</option>
                <option value="tiff">TIFF</option>
              </select>
            </div>
          </div>
        );

      case 'video-trim':
        return (
          <div className="space-y-4">
            <Input
              type="number"
              label="Start Time (seconds)"
              value={parameters.startTime || 0}
              onChange={(e) => updateParameter('startTime', parseInt(e.target.value))}
              placeholder="0"
            />
            <Input
              type="number"
              label="End Time (seconds)"
              value={parameters.endTime || 60}
              onChange={(e) => updateParameter('endTime', parseInt(e.target.value))}
              placeholder="60"
            />
          </div>
        );

      case 'code-execute':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Programming Language
              </label>
              <select
                value={parameters.language || 'python'}
                onChange={(e) => updateParameter('language', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(CODE_LANGUAGES).map(([key, lang]) => (
                  <option key={key} value={key}>{lang.name}</option>
                ))}
              </select>
            </div>
            <Input
              type="number"
              label="Timeout (seconds)"
              value={parameters.timeout || 30}
              onChange={(e) => updateParameter('timeout', parseInt(e.target.value))}
              placeholder="30"
            />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Memory Limit
              </label>
              <select
                value={parameters.memoryLimit || '512MB'}
                onChange={(e) => updateParameter('memoryLimit', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="128MB">128MB</option>
                <option value="256MB">256MB</option>
                <option value="512MB">512MB</option>
                <option value="1GB">1GB</option>
              </select>
            </div>
          </div>
        );

    
      case 'github-deploy':
        return (
          <div className="space-y-4">
            <Input
              type="url"
              label="GitHub Repository URL"
              value={parameters.githubUrl || ''}
              onChange={(e) => updateParameter('githubUrl', e.target.value)}
              placeholder="https://github.com/username/repository"
              required
            />
          </div>
        );
        
      default:
        return null;
    }
  };

  const parameters_content = renderParameters();

  if (!parameters_content) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-white">Task Parameters</h3>
      <Card>
        {parameters_content}
      </Card>
    </div>
  );
};

