const nodemailer = require('nodemailer');
const pool = require('./db');
require('dotenv').config();

function generarOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function enviarOTP(correo) {
  const codigo = generarOTP();
  const fechaCreacion = new Date();
  const fechaExpiracion = new Date(fechaCreacion.getTime() + 10 * 60000);

  await pool.execute(
    `INSERT INTO VERIFICACION_OTP (codigo, correo, fecha_creacion, fecha_expiracion, utilizado)
     VALUES (?, ?, ?, ?, false)`,
    [codigo, correo, fechaCreacion, fechaExpiracion]
  );

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: correo,
    subject: 'Código de verificación OTP',
    text: `Tu código OTP es: ${codigo}`
  };

  await transporter.sendMail(mailOptions);
}

async function verificarOTP(correo, codigo) {
  const [rows] = await pool.execute(
    `SELECT * FROM VERIFICACION_OTP
     WHERE correo = ? AND codigo = ? AND utilizado = false AND fecha_expiracion > NOW()`,
    [correo, codigo]
  );

  if (rows.length === 0) return false;

  await pool.execute(`UPDATE VERIFICACION_OTP SET utilizado = true WHERE id = ?`, [rows[0].id]);
  return true;
}

module.exports = { enviarOTP, verificarOTP };
