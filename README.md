<div align="center">

<img src="https://img.shields.io/badge/RentGF-India's%20%231%20Companion%20App-ec4899?style=for-the-badge&logo=heart&logoColor=white" />

# 💖 RentGF — Find Your Perfect Companion

**India's Premium Companion Platform** — Connect with real people for coffee dates, events, movies & meaningful conversations.

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-rentgf--app.vercel.app-a855f7?style=for-the-badge)](https://rentgf-app.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=for-the-badge&logo=render)](https://rentgf-and-bf.onrender.com)
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-000000?style=for-the-badge&logo=vercel)](https://rentgf-app.vercel.app)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **OTP Email Verification** | Gmail SMTP powered OTP — register karo, email verify karo, tab login |
| 👤 **Role-Based Dashboards** | Alag alag interface for Boys, Girls aur Admin |
| 💬 **Real-Time Chat** | Socket.io powered instant messaging with read receipts & delete |
| 📞 **WebRTC Calling** | Video & Audio calls with live ringing, instant silent connect, front/back camera toggling |
| 🚨 **SOS Emergency System** | Add up to 3 emergency contacts ( validated ), trigger live GPS location alerts |
| 📅 **Booking System** | Booking request bhejo, accept/reject karo, complete karo |
| 🪪 **KYC Verification** | ID proof upload — platform safety ke liye |
| 🖼️ **Gallery & Posts** | Profile pics, posts upload, like, comment, liked & saved posts views |
| 🔔 **Notifications** | Real-time activity notifications |
| 🛡️ **Super Admin Panel** | Full user control — freeze, block, delete, KYC approve, live SOS dashboard |
| 🔍 **Smart Search & Filter** | Girls/Boys/KYC/Frozen filter + search by name, email, phone |
| 📊 **Admin Analytics** | User stats, gender distribution, KYC rate charts |
| 🎨 **UI Cleanup** | Emojis replaced with clean, professional React Icons (`FiStar`, `FiMapPin`, etc.) |
| 📱 **Responsive Design** | Mobile, tablet, desktop — sab pe perfectly kaam karta hai |

---

## 🛠️ Tech Stack

### Frontend
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=flat-square&logo=tailwindcss)
![Socket.io](https://img.shields.io/badge/Socket.io-Client-010101?style=flat-square&logo=socket.io)

### Backend
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js)
![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=flat-square&logo=postgresql)
![Socket.io](https://img.shields.io/badge/Socket.io-Server-010101?style=flat-square&logo=socket.io)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Media-3448C5?style=flat-square&logo=cloudinary)
![Nodemailer](https://img.shields.io/badge/Nodemailer-Gmail%20SMTP-22B573?style=flat-square)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?style=flat-square&logo=jsonwebtokens)
![Bcrypt](https://img.shields.io/badge/Bcrypt-Security-orange?style=flat-square)

### Deployment
![Vercel](https://img.shields.io/badge/Frontend-Vercel-000?style=flat-square&logo=vercel)
![Render](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat-square&logo=render)
![NeonDB](https://img.shields.io/badge/Database-Neon%20PostgreSQL-00E5A0?style=flat-square)

---

## ⚙️ Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Priyanshu-kumar-maurya/companion-app.git
cd companion-app
```

### 2. Install Dependencies

```bash
# Frontend dependencies (root folder)
npm install

# Backend dependencies
cd backend
npm install
```

### 3. Environment Variables

`backend/.env` file banao aur ye variables add karo:

```env
PORT=5000
DATABASE_URL=your_postgresql_connection_string

JWT_SECRET=your_jwt_secret_key

# Gmail SMTP (OTP ke liye)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password_16chars

# Cloudinary (image upload ke liye)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

> **Gmail App Password kaise banaye?**
> Google Account → Security → 2-Step Verification ON karo → App Passwords → "Mail" select karo → 16 digit password copy karo

### 4. Run the Application

```bash
# Terminal 1 — Frontend start karo (root folder mein)
npm start

# Terminal 2 — Backend start karo
cd backend
node server.js
```

Frontend: `http://localhost:3000`
Backend API: `http://localhost:5000`

---

## 🗂️ Project Structure

```
companion-app/
├── src/                        # React Frontend
│   ├── components/
│   │   ├── AdminDashboard.jsx  # Super Admin Panel
│   │   ├── UnifiedLogin.jsx    # Login + Forgot Password
│   │   ├── UnifiedRegister.jsx # Registration + OTP Verify
│   │   ├── boy/                # Boy user components
│   │   ├── girl/               # Girl user components
│   │   └── shared/             # Shared components (Chat, Find, etc.)
│   └── App.js
│
├── backend/
│   ├── server.js               # Express server entry point
│   ├── package.json            # Backend dependencies
│   ├── config/
│   │   └── db.js               # PostgreSQL connection + auto-migration
│   ├── routes/
│   │   ├── authRoutes.js       # Register, Login, OTP, Forgot Password
│   │   ├── userRoutes.js       # Profile, KYC, social features
│   │   ├── bookingRoutes.js    # Booking system
│   │   ├── postRoutes.js       # Posts, likes, comments
│   │   ├── chatRoutes.js       # Chat messages
│   │   ├── adminRoutes.js      # Admin controls
│   │   └── sosRoutes.js        # SOS Emergency Alerts & Contacts
│   ├── middleware/
│   │   ├── rateLimiter.js      # API rate limiting
│   │   └── sanitize.js         # XSS protection
│   └── socket/
│       └── socket.js           # Real-time Socket.io handler
│
└── README.md
```

---

## 🔐 Security Features

- ✅ **OTP Email Verification** — Har naya user email verify kare
- ✅ **JWT Authentication** — 7-day tokens with auto-renewal
- ✅ **Bcrypt Password Hashing** — 12 rounds, secure hashing
- ✅ **Rate Limiting** — 5 auth attempts/min per IP
- ✅ **CORS White list** — Sirf approved origins allowed
- ✅ **Helmet.js** — 30+ HTTP security headers
- ✅ **XSS Sanitization** — Input sanitization middleware
- ✅ **Admin Controls** — Freeze, block, delete users

---

## 📸 Screenshots

| Home Page | Admin Panel | Chat |
|---|---|---|
| *Coming soon* | *Coming soon* | *Coming soon* |

---

## 🌐 Live Links

| Service | URL |
|---|---|
| 🌐 **Frontend (Vercel)** | https://rentgf-app.vercel.app |
| ⚙️ **Backend API (Render)** | https://rentgf-and-bf.onrender.com |
| 📦 **GitHub Repo** | https://github.com/Priyanshu-kumar-maurya/companion-app |

> **Note:** Backend Render free tier pe hai — pehli request mein 30-60 seconds lag sakte hain server wake up hone mein.

---

## 🤝 Contributing

Pull requests welcome hain! Large changes ke liye pehle issue open karo.

---

<div align="center">

**Built with ❤️ by Priyanshu Kumar Maurya(https://github.com/Priyanshu-kumar-maurya)**

⭐ **Agar pasand aaya toh star dena mat bhoolna!** ⭐

</div>
