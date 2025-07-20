import React from 'react';
import { motion } from 'framer-motion';
import { TaskType } from '../../types';
import { TASK_TYPES } from '../../utils/constants';
import { Card } from '../common/Card';
import { iconMap } from '../../utils/iconMapping';

interface TaskTypeSelectorProps {
  selectedType: TaskType | null;
  onTypeSelect: (type: TaskType) => void;
}

export const TaskTypeSelector: React.FC<TaskTypeSelectorProps> = ({
  selectedType,
  onTypeSelect
}) => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Select Task Type</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(TASK_TYPES).map(([type, config]) => {
          const IconComponent = iconMap[config.icon];
          
          return (
            <motion.div
              key={type}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                hover
                onClick={() => {
                  onTypeSelect(type as TaskType);
                  window.scrollBy({ top: window.innerHeight * 0.4, behavior: 'smooth' });
                }}
                className={`cursor-pointer transition-all duration-300 ${
                  selectedType === type
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'hover:border-blue-400/50'
                }`}
              >
                <div className="text-center space-y-3">
                  <div className="text-blue-400 flex justify-center">
                    <IconComponent size={48} />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{config.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{config.description}</p>
                  </div>
                  <div className="text-xs text-gray-500">
                    Max: {Math.round(config.maxSize / (1024 * 1024))}MB
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
