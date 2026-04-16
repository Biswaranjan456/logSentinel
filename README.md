🚀 LogSentinel
📌 About the Project

LogSentinel is a log management and anomaly detection platform that helps monitor application logs in real time. It detects unusual behavior like errors, traffic spikes, and security threats using rule-based logic and machine learning.

The goal of this project is to make log analysis simple, fast, and useful for developers.

✨ Features
📥 Log Ingestion & Parsing
Upload log files (including .gz files)
Accept logs through API
Automatically extract:
Timestamp
Log level (INFO, ERROR, etc.)
Source
Message
🤖 Anomaly Detection
Detect unusual patterns in logs
Identify:
Traffic spikes
Errors
Slow queries
Security issues (e.g., brute force)
Uses Isolation Forest (ML model)
📊 Dashboard
View system activity in one place
24-hour log volume chart
Log severity distribution
System health score
🚨 Incident Management
Alerts based on severity:
Critical
High
Medium
Low
Mark issues as resolved
Add resolution notes
⚡ Backend Performance
Built with FastAPI
Async support using Motor (MongoDB)
Fast and scalable APIs
🛠️ Tech Stack
💻 Backend
Python
FastAPI
Pydantic
🗄️ Database
MongoDB (Motor Async)
🤖 Machine Learning
Isolation Forest (scikit-learn)
🎨 Frontend
HTML
CSS
JavaScript
🌐 Live Links
🔗 Frontend:
https://logsentinel.onrender.com
🔗 Backend API:
https://logsentinel-backend-zesq.onrender.com
🔗 API Docs (Swagger):
https://logsentinel-backend-zesq.onrender.com/docs
⚙️ How It Works (Simple Flow)
Upload logs or send via API
Logs get parsed and stored in MongoDB
System runs anomaly detection
Dashboard shows insights and alerts
User can review and resolve issues
🚀 Future Improvements
Add user authentication
Real-time alerts (email/SMS)
More advanced ML models
Better UI/UX
👨‍💻 Author

Biswaranjan Patra
MCA Student | Software Development Intern
