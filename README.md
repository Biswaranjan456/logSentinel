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
=======
Frontend: https://logsentinel.onrender.com  
Backend: https://logsentinel-backend-zesq.onrender.com  
API Docs: https://logsentinel-backend-zesq.onrender.com/docs  

---

## How It Works

1. Upload logs or send them through API  
2. Logs are parsed and stored in database  
3. System checks for unusual patterns  
4. Dashboard shows results and alerts  
5. User can review and resolve issues  

---

## Future Improvements

- Add login system  
- Real-time alerts  
- Improve UI  
- Add more advanced features  

---

## Author
Biswaranjan Patra  
MCA Student | Software Development Intern  

---

## Support
If you like this project, give it a star on GitHub.
>>>>>>> 801e2881a385a4bb2e7d10074247cba4b87b2107
