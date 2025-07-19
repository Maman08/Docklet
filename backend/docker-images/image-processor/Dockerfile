FROM python:3.9-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo-dev \
    libpng-dev \
    libwebp-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt
COPY process_image.py .

CMD ["python", "process_image.py"]

