#!/usr/bin/env python3
import sys
import json
import traceback
import os
from pathlib import Path
import PyPDF2
import pdfplumber
import pytesseract
from pdf2image import convert_from_path
import base64

class PDFProcessor:
    def __init__(self):
        self.max_file_size = 50 * 1024 * 1024
        
    def extract_text_pypdf2(self, pdf_path, page_start=None, page_end=None):
        """Extract text using PyPDF2 - optimized version"""
        text = ""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                total_pages = len(pdf_reader.pages)
                
                # Determine page range with bounds checking
                start = max(0, (page_start - 1) if page_start else 0)
                end = min(total_pages, page_end if page_end else total_pages)
                
                for page_num in range(start, end):
                    try:
                        page = pdf_reader.pages[page_num]
                        page_text = page.extract_text()
                        if page_text and page_text.strip():
                            text += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
                    except Exception as e:
                        text += f"\n--- Page {page_num + 1} (Error: {str(e)[:50]}) ---\n"
        except Exception as e:
            raise Exception(f"PyPDF2 extraction failed: {str(e)[:100]}")
        
        return text
    
    def extract_text_pdfplumber(self, pdf_path, page_start=None, page_end=None, extract_tables=False):
        """Extract text using pdfplumber - optimized version"""
        text = ""
        tables_data = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)
                
                # Optimized page range calculation
                start = max(0, (page_start - 1) if page_start else 0)
                end = min(total_pages, page_end if page_end else total_pages)
                
                for page_num in range(start, end):
                    try:
                        page = pdf.pages[page_num]
                        page_text = page.extract_text()
                        if page_text and page_text.strip():
                            text += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
                        
                        # Optimized table extraction
                        if extract_tables:
                            tables = page.extract_tables()
                            if tables:
                                text += f"\n--- Tables on Page {page_num + 1} ---\n"
                                for table_num, table in enumerate(tables):
                                    if table:
                                        # More efficient table processing
                                        table_text = []
                                        for row in table:
                                            if row:
                                                clean_row = [str(cell).strip() if cell else "" for cell in row]
                                                if any(clean_row):  # Only add non-empty rows
                                                    table_text.append(" | ".join(clean_row))
                                        
                                        if table_text:
                                            text += f"Table {table_num + 1}:\n" + "\n".join(table_text) + "\n\n"
                                            
                                            # Store structured table data
                                            tables_data.append({
                                                'page': page_num + 1,
                                                'table_index': table_num,
                                                'data': table
                                            })
                    except Exception as e:
                        text += f"\n--- Page {page_num + 1} (Error: {str(e)[:50]}) ---\n"
        except Exception as e:
            raise Exception(f"pdfplumber extraction failed: {str(e)[:100]}")
        
        return text, tables_data
    
    def extract_text_ocr(self, pdf_path, page_start=None, page_end=None):
        """Extract text using OCR - optimized version"""
        text = ""
        try:
            # Convert with optimized settings
            images = convert_from_path(pdf_path, dpi=200, first_page=page_start, last_page=page_end)
            
            for page_num, image in enumerate(images):
                try:
                    # Use optimized OCR settings
                    page_text = pytesseract.image_to_string(
                        image, 
                        lang='eng',
                        config='--oem 3 --psm 6'  # Optimized OCR settings
                    )
                    if page_text and page_text.strip():
                        actual_page = (page_start or 1) + page_num
                        text += f"\n--- Page {actual_page} (OCR) ---\n{page_text}\n"
                except Exception as e:
                    actual_page = (page_start or 1) + page_num
                    text += f"\n--- Page {actual_page} (OCR Error: {str(e)[:50]}) ---\n"
                    
        except Exception as e:
            raise Exception(f"OCR extraction failed: {str(e)[:100]}")
        
        return text
    
    def get_pdf_metadata(self, pdf_path):
        """Extract PDF metadata - optimized version"""
        metadata = {'num_pages': 0}
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                metadata['num_pages'] = len(pdf_reader.pages)
                
                # Only extract metadata if it exists
                if pdf_reader.metadata:
                    info = pdf_reader.metadata
                    # Only include non-empty metadata
                    for key, pdf_key in [
                        ('title', '/Title'), ('author', '/Author'), 
                        ('subject', '/Subject'), ('creator', '/Creator'),
                        ('producer', '/Producer')
                    ]:
                        value = info.get(pdf_key, '')
                        if value:
                            metadata[key] = str(value)
                    
                    # Handle dates separately
                    for key, pdf_key in [('creation_date', '/CreationDate'), ('modification_date', '/ModDate')]:
                        value = info.get(pdf_key)
                        if value:
                            metadata[key] = str(value)
                    
        except Exception as e:
            metadata['error'] = f"Metadata extraction failed: {str(e)[:50]}"
        
        return metadata

def process_from_env():
    """Process PDF using environment variables - optimized version"""
    
    # Get environment variables with defaults
    input_file = os.getenv('INPUT_FILE')
    output_file = os.getenv('OUTPUT_FILE')
    extract_images = os.getenv('EXTRACT_IMAGES', 'false').lower() == 'true'
    extract_tables = os.getenv('EXTRACT_TABLES', 'false').lower() == 'true'
    output_format = os.getenv('OUTPUT_FORMAT', 'text').lower()
    page_start = os.getenv('PAGE_START')
    page_end = os.getenv('PAGE_END')
    
    # Validation
    if not input_file or not output_file:
        raise Exception("INPUT_FILE and OUTPUT_FILE environment variables are required")
    
    if not os.path.exists(input_file):
        raise Exception(f"Input file not found: {input_file}")
    
    # Parse page range with error handling
    try:
        page_start_int = int(page_start) if page_start and page_start.strip() else None
        page_end_int = int(page_end) if page_end and page_end.strip() else None
    except ValueError as e:
        raise Exception(f"Invalid page range: {e}")
    
    print(f"Processing: {input_file}", file=sys.stderr)
    print(f"Output: {output_file}", file=sys.stderr)
    print(f"Format: {output_format}", file=sys.stderr)
    
    # Process PDF
    processor = PDFProcessor()
    
    # Get metadata first (lightweight operation)
    metadata = processor.get_pdf_metadata(input_file)
    total_pages = metadata.get('num_pages', 0)
    print(f"PDF has {total_pages} pages", file=sys.stderr)
    
    # Validate page range
    if page_start_int and page_start_int > total_pages:
        raise Exception(f"Start page {page_start_int} exceeds total pages {total_pages}")
    if page_end_int and page_end_int > total_pages:
        print(f"Warning: End page {page_end_int} exceeds total pages {total_pages}, adjusting to {total_pages}", file=sys.stderr)
        page_end_int = total_pages
    
    # Extract text with fallback strategy
    text = ""
    tables_data = []
    
    try:
        # Primary: pdfplumber
        text, tables_data = processor.extract_text_pdfplumber(
            input_file, page_start_int, page_end_int, extract_tables
        )
    except Exception as e:
        print(f"pdfplumber failed: {e}", file=sys.stderr)
    
    if not text.strip():
        try:
            # Fallback: PyPDF2
            print("Trying PyPDF2...", file=sys.stderr)
            text = processor.extract_text_pypdf2(input_file, page_start_int, page_end_int)
        except Exception as e:
            print(f"PyPDF2 failed: {e}", file=sys.stderr)
    
    if not text.strip():
        try:
            # Last resort: OCR
            print("Trying OCR...", file=sys.stderr)
            text = processor.extract_text_ocr(input_file, page_start_int, page_end_int)
        except Exception as e:
            print(f"OCR failed: {e}", file=sys.stderr)
            text = "No text could be extracted from this PDF."
    
    # Prepare optimized output data
    result_data = {
        'text': text,
        'metadata': metadata,
        'extraction_info': {
            'pages_processed': f"{page_start_int or 1}-{page_end_int or total_pages}",
            'total_pages': total_pages,
            'extract_tables': extract_tables,
            'text_length': len(text)
        }
    }
    
    # Add tables only if extracted
    if extract_tables and tables_data:
        result_data['tables'] = tables_data
    
    # Write output efficiently
    try:
        if output_format == 'json':
            output_path = f"{output_file}.json"
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result_data, f, indent=2, ensure_ascii=False)
        elif output_format == 'markdown':
            output_path = f"{output_file}.md"
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(f"# PDF Extraction Results\n\n")
                f.write(f"**Pages:** {result_data['extraction_info']['pages_processed']}\n")
                f.write(f"**Total Pages:** {total_pages}\n")
                f.write(f"**Characters Extracted:** {len(text)}\n\n")
                f.write(f"## Text Content\n\n{text}\n")
                
                if tables_data:
                    f.write(f"\n## Extracted Tables\n\n")
                    for table in tables_data:
                        f.write(f"### Table on Page {table['page']}\n\n")
                        if table.get('data'):
                            for row in table['data']:
                                if row:
                                    f.write('| ' + ' | '.join(str(cell) if cell else '' for cell in row) + ' |\n')
                        f.write('\n')
        else:
            # Default: text format
            output_path = f"{output_file}.txt"
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(text)
        
        print(f"Extraction completed: {output_path}", file=sys.stderr)
        print(f"Extracted {len(text)} characters", file=sys.stderr)
        
        return output_path
        
    except Exception as e:
        raise Exception(f"Failed to write output: {e}")

def main():
    try:
        # Environment mode (Docker)
        if os.getenv('INPUT_FILE') and os.getenv('OUTPUT_FILE'):
            process_from_env()
        else:
            # Original stdin mode for backward compatibility
            result = {'error': 'Stdin mode not implemented in optimized version'}
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': f'Processing error: {str(e)}',
            'timestamp': str(os.environ.get('TIMESTAMP', 'unknown'))
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()