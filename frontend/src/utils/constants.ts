import { TaskType } from '../types';

export const TASK_TYPES: { [key in TaskType]: {
  name: string;
  description: string;
  icon: string;
  maxSize: number;
  supportedFormats: string[];
} } = {
  'image-convert': {
    name: 'Image Conversion',
    description: 'Convert images between different formats',
    icon: 'Image',
    maxSize: 50 * 1024 * 1024, // 50MB
    supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff']
  },
  'pdf-extract': {
    name: 'PDF Text Extraction',
    description: 'Extract text content from PDF files',
    icon: 'FileText',
    maxSize: 100 * 1024 * 1024, // 100MB
    supportedFormats: ['pdf']
  },
  'video-trim': {
    name: 'Video Trimming',
    description: 'Trim videos with precision timing',
    icon: 'Video',
    maxSize: 500 * 1024 * 1024, // 500MB
    supportedFormats: ['mp4', 'avi', 'mov', 'mkv', 'wmv']
  },
  'csv-analyze': {
    name: 'CSV Analysis',
    description: 'Analyze CSV data and generate insights',
    icon: 'BarChart3',
    maxSize: 50 * 1024 * 1024, // 50MB
    supportedFormats: ['csv']
  },
  'code-execute': {
    name: 'Code Execution',
    description: 'Execute code in multiple languages',
    icon: 'Code',
    maxSize: 10 * 1024 * 1024, // 10MB
    supportedFormats: ['py', 'js', 'java', 'cpp', 'c', 'go', 'rs']
  },
  'deploy-app': {
    name: 'App Deployment',
    description: 'Deploy applications',
    icon: 'Rocket',
    maxSize: 100 * 1024 * 1024, // 100MB
    supportedFormats: ['zip', 'tar', 'gz']
  },
  'github-deploy': {
    name: 'GitHub Deploy',
    description: 'Deploy applications from GitHub repositories',
    icon: 'Github', 
    maxSize: 0, 
    supportedFormats: [] 
  }
};

export const CODE_LANGUAGES = {
  python: { name: 'Python', extension: 'py', template: 'print("Hello, World!")' },
  javascript: { name: 'JavaScript', extension: 'js', template: 'console.log("Hello, World!");' },
  java: { name: 'Java', extension: 'java', template: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}' },
  cpp: { name: 'C++', extension: 'cpp', template: '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello, World!" << endl;\n  return 0;\n}' },
  c: { name: 'C', extension: 'c', template: '#include <stdio.h>\n\nint main() {\n  printf("Hello, World!\\n");\n  return 0;\n}' },
  go: { name: 'Go', extension: 'go', template: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, World!")\n}' },
  rust: { name: 'Rust', extension: 'rs', template: 'fn main() {\n  println!("Hello, World!");\n}' }
};

export const APP_TYPES = {
  nodejs: { name: 'Node.js', defaultPort: 3000 },
  react: { name: 'React', defaultPort: 3000 },
  vue: { name: 'Vue.js', defaultPort: 8080 },
  angular: { name: 'Angular', defaultPort: 4200 },
  static: { name: 'Static HTML', defaultPort: 8080 },
  python: { name: 'Python Flask/FastAPI', defaultPort: 5000 }
};