#!/usr/bin/env python3
import sys
import json
import traceback
import tempfile
import os
import pandas as pd
import numpy as np
from io import StringIO
import base64

class CSVAnalyzer:
    def __init__(self):
        self.max_file_size = 10 * 1024 * 1024  
        self.max_rows = 50000  # Maximum rows to process
        
    def detect_encoding(self, csv_data):
        """Detect CSV encoding"""
        encodings = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']
        
        for encoding in encodings:
            try:
                csv_data.decode(encoding)
                return encoding
            except UnicodeDecodeError:
                continue
        
        return 'utf-8'  # Default fallback
    
    def detect_delimiter(self, csv_sample):
        """Detect CSV delimiter"""
        delimiters = [',', ';', '\t', '|']
        delimiter_counts = {}
        
        for delimiter in delimiters:
            count = csv_sample.count(delimiter)
            if count > 0:
                delimiter_counts[delimiter] = count
        
        if delimiter_counts:
            return max(delimiter_counts, key=delimiter_counts.get)
        
        return ','  # Default
    
    def basic_analysis(self, df):
        """Perform basic statistical analysis"""
        analysis = {
            'shape': df.shape,
            'columns': list(df.columns),
            'dtypes': df.dtypes.astype(str).to_dict(),
            'memory_usage': df.memory_usage(deep=True).sum(),
            'null_counts': df.isnull().sum().to_dict(),
            'duplicate_rows': df.duplicated().sum()
        }
        
        # Basic statistics for numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if numeric_cols:
            analysis['numeric_summary'] = df[numeric_cols].describe().to_dict()
        
        # Basic statistics for string columns
        string_cols = df.select_dtypes(include=['object']).columns.tolist()
        if string_cols:
            analysis['string_summary'] = {}
            for col in string_cols:
                analysis['string_summary'][col] = {
                    'unique_count': df[col].nunique(),
                    'most_common': df[col].value_counts().head(5).to_dict() if not df[col].empty else {}
                }
        
        return analysis
    
    def data_quality_check(self, df):
        """Perform data quality analysis"""
        quality = {
            'completeness': {},
            'consistency': {},
            'validity': {}
        }
        
        # Completeness check
        total_cells = df.shape[0] * df.shape[1]
        null_cells = df.isnull().sum().sum()
        quality['completeness']['overall_completeness'] = (total_cells - null_cells) / total_cells * 100
        
        for col in df.columns:
            null_count = df[col].isnull().sum()
            quality['completeness'][col] = (len(df) - null_count) / len(df) * 100
        
        # Consistency checks
        for col in df.columns:
            if df[col].dtype == 'object':
                # Check for mixed case variations
                if not df[col].empty:
                    values = df[col].dropna().astype(str)
                    lower_values = values.str.lower()
                    consistency_ratio = len(lower_values.unique()) / len(values.unique()) if len(values.unique()) > 0 else 1
                    quality['consistency'][col] = consistency_ratio * 100
        
        # Validity checks (basic patterns)
        for col in df.columns:
            if df[col].dtype == 'object' and not df[col].empty:
                values = df[col].dropna().astype(str)
                
                # Email pattern check
                if 'email' in col.lower() or 'mail' in col.lower():
                    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                    valid_emails = values.str.match(email_pattern).sum()
                    quality['validity'][f'{col}_email_format'] = valid_emails / len(values) * 100
                
                # Phone pattern check (basic)
                if 'phone' in col.lower() or 'tel' in col.lower():
                    phone_pattern = r'^\+?[\d\s\-\(\)]{7,}$'
                    valid_phones = values.str.match(phone_pattern).sum()
                    quality['validity'][f'{col}_phone_format'] = valid_phones / len(values) * 100
        
        return quality
    
    def generate_insights(self, df, analysis):
        """Generate insights and recommendations"""
        insights = []
        
        # Data size insights
        rows, cols = df.shape
        insights.append(f"Dataset contains {rows:,} rows and {cols} columns")
        
        # Missing data insights
        null_cols = [col for col, count in analysis['null_counts'].items() if count > 0]
        if null_cols:
            insights.append(f"Missing data found in {len(null_cols)} columns: {', '.join(null_cols[:5])}")
        
        # Duplicate data insights
        if analysis['duplicate_rows'] > 0:
            insights.append(f"Found {analysis['duplicate_rows']} duplicate rows ({analysis['duplicate_rows']/rows*100:.1f}%)")
        
        # Data type insights
        numeric_count = len([col for col, dtype in analysis['dtypes'].items() if 'int' in str(dtype) or 'float' in str(dtype)])
        string_count = len([col for col, dtype in analysis['dtypes'].items() if 'object' in str(dtype)])
        insights.append(f"Data types: {numeric_count} numeric, {string_count} text columns")
        
        # Memory usage insight
        memory_mb = analysis['memory_usage'] / (1024 * 1024)
        insights.append(f"Memory usage: {memory_mb:.2f} MB")
        
        # Recommendations
        recommendations = []
        
        if analysis['duplicate_rows'] > 0:
            recommendations.append("Consider removing duplicate rows to improve data quality")
        
        if len(null_cols) > 0:
            recommendations.append("Address missing data through imputation or removal")
        
        # Check for potential ID columns
        potential_ids = []
        for col in df.columns:
            if df[col].nunique() == len(df) and not df[col].isnull().any():
                potential_ids.append(col)
        
        if potential_ids:
            recommendations.append(f"Columns {', '.join(potential_ids)} appear to be unique identifiers")
        
        return {
            'insights': insights,
            'recommendations': recommendations
        }
    
    def analyze_csv(self, csv_data, options=None):
        """Analyze CSV data"""
        if options is None:
            options = {}
        
        result = {
            'success': False,
            'analysis': {},
            'quality': {},
            'insights': {},
            'sample_data': {},
            'error': ''
        }
        
        # Check file size
        if len(csv_data) > self.max_file_size:
            result['error'] = f'File too large. Maximum size is {self.max_file_size // (1024*1024)}MB'
            return result
        
        try:
            # Detect encoding
            encoding = options.get('encoding', self.detect_encoding(csv_data))
            csv_text = csv_data.decode(encoding)
            
            # Detect delimiter
            delimiter = options.get('delimiter', self.detect_delimiter(csv_text[:1000]))
            
            # Read CSV
            df = pd.read_csv(
                StringIO(csv_text),
                delimiter=delimiter,
                encoding=encoding,
                nrows=self.max_rows,
                low_memory=False
            )
            
            # Basic analysis
            result['analysis'] = self.basic_analysis(df)
            
            # Data quality analysis
            result['quality'] = self.data_quality_check(df)
            
            # Generate insights
            result['insights'] = self.generate_insights(df, result['analysis'])
            
            # Sample data (first few rows)
            sample_size = min(5, len(df))
            if sample_size > 0:
                result['sample_data'] = {
                    'head': df.head(sample_size).to_dict('records'),
                    'columns': list(df.columns)
                }
            
            # Additional metadata
            result['metadata'] = {
                'encoding_used': encoding,
                'delimiter_used': delimiter,
                'rows_processed': len(df),
                'total_file_size': len(csv_data)
            }
            
            result['success'] = True
            
        except Exception as e:
            result['error'] = str(e)
            result['traceback'] = traceback.format_exc()
        
        return result

def main():
    try:
        # Read input from stdin
        input_data = sys.stdin.buffer.read()
        
        if not input_data:
            print(json.dumps({'error': 'No input provided'}))
            return
        
        # Parse input (expect base64 encoded CSV data and options)
        try:
            # First try to parse as JSON
            text_input = input_data.decode('utf-8')
            data = json.loads(text_input)
            
            # Decode base64 CSV data
            csv_data = base64.b64decode(data['csv_data'])
            options = data.get('options', {})
            
        except (json.JSONDecodeError, UnicodeDecodeError):
            # Assume raw CSV data
            csv_data = input_data
            options = {}
        
        # Analyze the CSV
        analyzer = CSVAnalyzer()
        result = analyzer.analyze_csv(csv_data, options)
        
        # Output result as JSON
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': f'Analysis error: {str(e)}',
            'traceback': traceback.format_exc()
        }
        print(json.dumps(error_result))

if __name__ == '__main__':
    main()