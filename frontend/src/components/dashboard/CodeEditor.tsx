import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { motion } from 'framer-motion';
import { Play, Save, Download, Code } from 'lucide-react';
import { CODE_LANGUAGES } from '../../utils/constants';
import { Card } from '../common/Card';
import { Button } from '../common/Button';

interface CodeEditorProps {
  language: string;
  code: string;
  onCodeChange: (code: string) => void;
  onLanguageChange: (language: string) => void;
  onExecute: () => void;
  executing?: boolean;
  output?: string;
  error?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  language,
  code,
  onCodeChange,
  onLanguageChange,
  onExecute,
  executing = false,
  output,
  error
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const languageConfig = CODE_LANGUAGES[language as keyof typeof CODE_LANGUAGES];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center">
          <Code className="mr-2" size={20} />
          Code Editor
        </h3>
        <div className="flex items-center space-x-2">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(CODE_LANGUAGES).map(([key, lang]) => (
              <option key={key} value={key}>{lang.name}</option>
            ))}
          </select>
          <Button
            onClick={() => onCodeChange(languageConfig.template)}
            variant="ghost"
            size="sm"
          >
            Template
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="h-96">
          <Editor
            height="100%"
            language={language === 'cpp' ? 'cpp' : language}
            value={code}
            onChange={(value) => onCodeChange(value || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on'
            }}
          />
        </div>
      </Card>

      <div className="flex items-center space-x-2">
        <Button
          onClick={onExecute}
          loading={executing}
          className="flex-1"
        >
          <Play size={16} className="mr-2" />
          {executing ? 'Executing...' : 'Run Code'}
        </Button>
        <Button variant="secondary" size="md">
          <Save size={16} className="mr-2" />
          Save
        </Button>
      </div>

      {(output || error) && (
        <Card>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Output</h4>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
            {error ? (
              <div className="text-red-400">{error}</div>
            ) : (
              <div className="text-green-400 whitespace-pre-wrap">{output}</div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};