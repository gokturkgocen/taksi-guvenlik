FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download buffalo_l so first request doesn't pay download latency.
RUN python -c "from insightface.app import FaceAnalysis; \
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider']); \
    app.prepare(ctx_id=-1, det_size=(640,640))"

COPY app.py recognition.py db.py enroll.py auth.py ./

ENV PORT=8000 \
    DB_PATH=/app/data/embeddings.pkl

EXPOSE 8000

CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:8000", "app:app", "--timeout", "60"]
