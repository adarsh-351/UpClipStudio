FROM python:3.13-slim

# Install system dependencies required by the app
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        git \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first for better Docker caching
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn

# Copy application
COPY . .

# Render web service port
EXPOSE 10000

# Production WSGI server
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-10000} --workers 1 --timeout 300 'app:create_app()'"]
