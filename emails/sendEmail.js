const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,        // ← 465 वरून 587
  secure: false,    // ← true वरून false
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});