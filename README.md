# LogSentinel

## About the Project
LogSentinel is a simple log management and anomaly detection system. It helps monitor application logs in real time and find unusual activities like errors, traffic spikes, or security issues.

---

## Features

- Upload log files (including .gz files)
- Send logs using API
- Automatic parsing of timestamp, log level, source, and message
- Detect unusual patterns using basic logic and machine learning
- Dashboard to view logs, activity, and system health
- Alert system with different severity levels (Critical, High, Medium, Low)
- Option to mark issues as resolved

---

## Tech Stack

Backend: Python, FastAPI, Pydantic  
Database: MongoDB (Motor)  
Machine Learning: Isolation Forest  
Frontend: HTML, CSS, JavaScript  

---

## Live Links

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
