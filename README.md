# LogSentinel

## About the Project

**LogSentinel** is a robust log management and automated anomaly detection platform. It is designed to ingest, parse, and monitor application logs in real-time, utilizing both rule-based heuristics and Machine Learning (Isolation Forest) to detect unusual spikes, errors, and security threats (such as brute-force attempts and rate limit floods).

### Key Features
- **Log Ingestion & Parsing:** Upload log files (including compressed `.gz` archives) or ingest logs directly via API. The system automatically parses timestamps, log levels, sources, and messages.
- **Smart Anomaly Detection:** Run automated or manual ML scans to identify anomalies like unusual traffic spikes, memory leaks, and slow database queries.
- **Interactive Dashboard:** Get a bird's-eye view of your system's health with 24-hour volume charts, severity distributions, and a dynamically calculated system health score.
- **Incident Resolution:** Track alerts based on severities (Critical, High, Medium, Low) and mark anomalies as resolved with optional resolution notes.
- **High-Performance Backend:** Built on top of Python's FastAPI and Motor (Async MongoDB) for blazing-fast, non-blocking API endpoints.

### Built With
- **Backend:** Python, FastAPI, Pydantic
- **Database:** MongoDB (Motor Asyncio)
- **Machine Learning:** IsolationForest (scikit-learn)
- **Frontend:** HTML/CSS, Vanilla JavaScript

---

## Live Links

Frontend:  https://logsentinel.onrender.com

Backend:   https://logsentinel-backend-zesq.onrender.com

Swagger:   https://logsentinel-backend-zesq.onrender.com/docs