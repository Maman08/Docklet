import os
import sys
from PIL import Image

def convert_image():
    input_file = os.environ.get('INPUT_FILE')
    output_file = os.environ.get('OUTPUT_FILE')
    format_type = os.environ.get('FORMAT', 'jpg').lower()
    quality = int(os.environ.get('QUALITY', 80))
    width = os.environ.get('WIDTH')
    height = os.environ.get('HEIGHT')
    
    if not input_file or not output_file:
        print("Error: INPUT_FILE and OUTPUT_FILE must be specified")
        sys.exit(1)
    
    try:
        if not os.path.exists(input_file):
            print(f"Error: Input file does not exist: {input_file}")
            sys.exit(1)
            
        with Image.open(input_file) as img:
            if format_type in ['jpg', 'jpeg'] and img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            elif format_type == 'png' and img.mode == 'P':
                img = img.convert('RGBA')
            
            if width and height:
                img = img.resize((int(width), int(height)), Image.Resampling.LANCZOS)
            elif width:
                ratio = int(width) / img.width
                new_height = int(img.height * ratio)
                img = img.resize((int(width), new_height), Image.Resampling.LANCZOS)
            elif height:
                ratio = int(height) / img.height
                new_width = int(img.width * ratio)
                img = img.resize((new_width, int(height)), Image.Resampling.LANCZOS)
            
            save_kwargs = {}
            
            pil_format = format_type.upper()
            if format_type in ['jpg', 'jpeg']:
                pil_format = 'JPEG' 
                save_kwargs['quality'] = quality
                save_kwargs['optimize'] = True
            elif format_type == 'png':
                pil_format = 'PNG'
                if img.mode != 'RGBA':
                    save_kwargs['optimize'] = True
            
            full_output_path = f"{output_file}.{format_type}"
            
            output_dir = os.path.dirname(full_output_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)
            
            img.save(full_output_path, format=pil_format, **save_kwargs)
            print(f"Image conversion completed: {full_output_path}")
            
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    convert_image()