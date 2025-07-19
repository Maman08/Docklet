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
        """Extract text using PyPDF2"""
        text = ""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                total_pages = len(pdf_reader.pages)
                
                # Determine page range
                start = (page_start - 1) if page_start else 0
                end = page_end if page_end else total_pages
                start = max(0, start)
                end = min(total_pages, end)
                
                for page_num in range(start, end):
                    try:
                        page = pdf_reader.pages[page_num]
                        page_text = page.extract_text()
                        if page_text.strip():
                            text += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
                    except Exception as e:
                        text += f"\n--- Page {page_num + 1} (Error: {str(e)}) ---\n"
        except Exception as e:
            raise Exception(f"PyPDF2 extraction failed: {str(e)}")
        
        return text
    
    def extract_text_pdfplumber(self, pdf_path, page_start=None, page_end=None, extract_tables=False):
        """Extract text using pdfplumber (better for complex layouts)"""
        text = ""
        tables_data = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)
                
                # Determine page range
                start = (page_start - 1) if page_start else 0
                end = page_end if page_end else total_pages
                start = max(0, start)
                end = min(total_pages, end)
                
                for page_num in range(start, end):
                    try:
                        page = pdf.pages[page_num]
                        page_text = page.extract_text()
                        if page_text and page_text.strip():
                            text += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
                        
                        # Extract tables if requested
                        if extract_tables:
                            tables = page.extract_tables()
                            if tables:
                                text += f"\n--- Tables on Page {page_num + 1} ---\n"
                                for table_num, table in enumerate(tables):
                                    text += f"Table {table_num + 1}:\n"
                                    for row in table:
                                        if row:
                                            text += " | ".join([cell or "" for cell in row]) + "\n"
                                    text += "\n"
                                    
                                    # Store table data for JSON output
                                    tables_data.append({
                                        'page': page_num + 1,
                                        'table_index': table_num,
                                        'data': table
                                    })
                    except Exception as e:
                        text += f"\n--- Page {page_num + 1} (Error: {str(e)}) ---\n"
        except Exception as e:
            raise Exception(f"pdfplumber extraction failed: {str(e)}")
        
        return text, tables_data
    
    def extract_text_ocr(self, pdf_path, page_start=None, page_end=None):
        """Extract text using OCR for scanned PDFs"""
        text = ""
        try:
            # Convert PDF to images
            images = convert_from_path(pdf_path, dpi=200)
            total_pages = len(images)
            
            # Determine page range
            start = (page_start - 1) if page_start else 0
            end = page_end if page_end else total_pages
            start = max(0, start)
            end = min(total_pages, end)
            
            for page_num in range(start, end):
                try:
                    image = images[page_num]
                    # Use OCR to extract text from image
                    page_text = pytesseract.image_to_string(image, lang='eng')
                    if page_text.strip():
                        text += f"\n--- Page {page_num + 1} (OCR) ---\n{page_text}\n"
                except Exception as e:
                    text += f"\n--- Page {page_num + 1} (OCR Error: {str(e)}) ---\n"
                    
        except Exception as e:
            raise Exception(f"OCR extraction failed: {str(e)}")
        
        return text
    
    def get_pdf_metadata(self, pdf_path):
        """Extract PDF metadata"""
        metadata = {}
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                # Basic info
                metadata['num_pages'] = len(pdf_reader.pages)
                
                # Document info
                if pdf_reader.metadata:
                    info = pdf_reader.metadata
                    metadata['title'] = info.get('/Title', '')
                    metadata['author'] = info.get('/Author', '')
                    metadata['subject'] = info.get('/Subject', '')
                    metadata['creator'] = info.get('/Creator', '')
                    metadata['producer'] = info.get('/Producer', '')
                    metadata['creation_date'] = str(info.get('/CreationDate', ''))
                    metadata['modification_date'] = str(info.get('/ModDate', ''))
                    
        except Exception as e:
            metadata['error'] = f"Failed to extract metadata: {str(e)}"
        
        return metadata

def process_from_env():
    """Process PDF using environment variables (Docker mode)"""
    
    # Get environment variables
    input_file = os.getenv('INPUT_FILE')
    output_file = os.getenv('OUTPUT_FILE')
    extract_images = os.getenv('EXTRACT_IMAGES', 'false').lower() == 'true'
    extract_tables = os.getenv('EXTRACT_TABLES', 'false').lower() == 'true'
    output_format = os.getenv('OUTPUT_FORMAT', 'text').lower()
    page_start = os.getenv('PAGE_START')
    page_end = os.getenv('PAGE_END')
    
    print(f"Processing: {input_file}", file=sys.stderr)
    print(f"Output: {output_file}", file=sys.stderr)
    print(f"Format: {output_format}", file=sys.stderr)
    print(f"Extract tables: {extract_tables}", file=sys.stderr)
    
    if not input_file or not output_file:
        raise Exception("INPUT_FILE and OUTPUT_FILE environment variables are required")
    
    if not os.path.exists(input_file):
        raise Exception(f"Input file not found: {input_file}")
    
    # Parse page range
    page_start_int = int(page_start) if page_start and page_start.strip() else None
    page_end_int = int(page_end) if page_end and page_end.strip() else None
    
    # Process PDF
    processor = PDFProcessor()
    
    # Get metadata
    metadata = processor.get_pdf_metadata(input_file)
    print(f"PDF has {metadata.get('num_pages', 'unknown')} pages", file=sys.stderr)
    
    # Extract text and tables
    text, tables_data = processor.extract_text_pdfplumber(
        input_file, 
        page_start_int, 
        page_end_int, 
        extract_tables
    )
    
    if not text.strip():
        # Fallback to PyPDF2
        print("pdfplumber extracted no text, trying PyPDF2...", file=sys.stderr)
        text = processor.extract_text_pypdf2(input_file, page_start_int, page_end_int)
    
    if not text.strip():
        # Last resort: OCR (if available)
        print("PyPDF2 extracted no text, trying OCR...", file=sys.stderr)
        try:
            text = processor.extract_text_ocr(input_file, page_start_int, page_end_int)
        except Exception as e:
            print(f"OCR failed: {e}", file=sys.stderr)
            text = "No text could be extracted from this PDF."
    
    # Prepare output data
    result_data = {
        'text': text,
        'metadata': metadata,
        'tables': tables_data if extract_tables else [],
        'extraction_info': {
            'pages_processed': f"{page_start_int or 1}-{page_end_int or metadata.get('num_pages', '?')}",
            'extract_tables': extract_tables,
            'extract_images': extract_images
        }
    }
    
    # Write output based on format
    if output_format == 'json':
        output_path = f"{output_file}.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2, ensure_ascii=False)
    elif output_format == 'markdown':
        output_path = f"{output_file}.md"
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f"# PDF Extraction Results\n\n")
            f.write(f"**Pages:** {result_data['extraction_info']['pages_processed']}\n")
            f.write(f"**Total Pages:** {metadata.get('num_pages', 'Unknown')}\n\n")
            f.write(f"## Text Content\n\n{text}\n")
            
            if tables_data:
                f.write(f"\n## Tables\n\n")
                for table in tables_data:
                    f.write(f"### Table on Page {table['page']}\n\n")
                    if table['data']:
                        for row in table['data']:
                            f.write('| ' + ' | '.join(str(cell) if cell else '' for cell in row) + ' |\n')
                    f.write('\n')
    else:
        # Default to text format
        output_path = f"{output_file}.txt"
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(text)
    
    print(f"Extraction completed successfully. Output saved to: {output_path}", file=sys.stderr)
    print(f"Extracted {len(text)} characters of text", file=sys.stderr)
    
    return output_path

def process_from_stdin():
    """Process PDF from stdin (original mode)"""
    # Read input from stdin
    input_data = sys.stdin.buffer.read()
    
    if not input_data:
        return {'error': 'No input provided'}
    
    # Parse input (expect base64 encoded PDF data and options)
    try:
        # First try to parse as JSON
        text_input = input_data.decode('utf-8')
        data = json.loads(text_input)
        
        pdf_data = base64.b64decode(data['pdf_data'])
        options = data.get('options', {})
        
    except (json.JSONDecodeError, UnicodeDecodeError):
        # Assume raw PDF data
        pdf_data = input_data
        options = {}
    
    # Process the PDF using the original method
    processor = PDFProcessor()
    result = processor.process_pdf(pdf_data, options)
    
    return result

def main():
    try:
        # Check if running in Docker environment mode (with env vars)
        if os.getenv('INPUT_FILE') and os.getenv('OUTPUT_FILE'):
            # Docker environment mode
            process_from_env()
        else:
            # Original stdin mode
            result = process_from_stdin()
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': f'Processing error: {str(e)}',
            'traceback': traceback.format_exc()
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()