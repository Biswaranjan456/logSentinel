# 🚀 LogSentinel

## 📌 About the Project
LogSentinel is a log management and anomaly detection platform that helps monitor application logs in real time. It detects unusual behavior like errors, traffic spikes, and security threats using rule-based logic and machine learning.

---

## ✨ Features

### 📥 Log Ingestion & Parsing
- Upload log files (including `.gz` files)
- Accept logs through API
- Automatically extract timestamp, log level, source, and message

### 🤖 Anomaly Detection
- Detect unusual patterns in logs  
- Identify traffic spikes, errors, slow queries, and security issues  
- Uses Isolation Forest (ML model)

### 📊 Dashboard
- 24-hour log volume chart  
- Log severity distribution  
- System health score  

### 🚨 Incident Management
- Alerts based on severity (Critical, High, Medium, Low)  
- Mark issues as resolved  
- Add resolution notes  

### ⚡ Backend Performance
- Built with FastAPI  
- Async support using MongoDB (Motor)  
- Fast and scalable APIs  

---

## 🛠️ Tech Stack

**Backend:** Python, FastAPI, Pydantic  
**Database:** MongoDB (Motor Async)  
**Machine Learning:** Isolation Forest (scikit-learn)  
**Frontend:** HTML, CSS, JavaScript  

---

## 🌐 Live Links

- Frontend: https://logsentinel.onrender.com  
- Backend: https://logsentinel-backend-zesq.onrender.com  
- API Docs: https://logsentinel-backend-zesq.onrender.com/docs  

---

## ⚙️ How It Works

1. Upload logs or send via API  
2. Logs are parsed and stored in MongoDB  
3. System runs anomaly detection  
4. Dashboard shows insights and alerts  
5. User can review and resolve issues  

---

## 🚀 Future Improvements
- Add authentication  
- Real-time alerts (email/SMS)  
- Improve UI/UX  
- Advanced ML models  

---

## 👨‍💻 Author
Biswaranjan Patra  
MCA Student | Software Development Intern  

---

## ⭐ Support
If you like this project, give it a ⭐ on GitHub!
