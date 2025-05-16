const nodemailer = require('nodemailer');
const pool = require('./db');
require('dotenv').config();

// Generar código OTP de 6 dígitos
function generarCodigoOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function enviarOTP(correo) {
  const codigo = generarCodigoOTP();
  const fecha_creacion = new Date();
  const fecha_expiracion = new Date(fecha_creacion.getTime() + 5 * 60000); // +5 minutos

  await pool.execute(
    `INSERT INTO VERIFICACION_OTP (codigo, correo, fecha_creacion, fecha_expiracion, utilizado)
     VALUES (?, ?, ?, ?, false)`,
    [codigo, correo, fecha_creacion, fecha_expiracion]
  );

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const html = `
    <div style="font-family: Arial, sans-serif; background: #f2f2f2; padding: 40px;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <div style="text-align: center;">
          <img src="https://i.imgur.com/vf6Lg64.png" alt="Logo Accesorios Apolo" style="max-width: 120px; margin-bottom: 20px;" />
        </div>
        <h2 style="color: #333; text-align: center;">Verificación de correo electrónico</h2>
        <p style="font-size: 16px; color: #555; text-align: center;">
          ¡Gracias por registrarte en <strong>Accesorios Apolo</strong>!
        </p>
        <p style="font-size: 16px; color: #555; text-align: center;">
          Ingresa el siguiente código para verificar tu dirección de correo:
        </p>
        <div style="background: #f0f8ff; font-size: 28px; font-weight: bold; color: #0077cc; text-align: center; padding: 15px 0; margin: 30px 0; border-radius: 8px;">
          ${codigo}
        </div>
        <p style="font-size: 14px; color: #888; text-align: center;">
          Este código expirará en 5 minutos.
        </p>
        <hr style="margin: 40px 0; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #aaa; text-align: center;">
          Si no solicitaste este código, puedes ignorar este correo.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Accesorios Apolo" <${process.env.EMAIL_USER}>`,
    to: correo,
    subject: 'Tu código de verificación OTP',
    html
  });
}

async function verificarOTP(correo, codigo) {
  const [rows] = await pool.execute(
    `SELECT * FROM VERIFICACION_OTP
     WHERE correo = ? AND codigo = ? AND utilizado = false AND fecha_expiracion > NOW()`,
    [correo, codigo]
  );

  if (rows.length === 0) return false;

  await pool.execute(
    `UPDATE VERIFICACION_OTP SET utilizado = true WHERE id = ?`,
    [rows[0].id]
  );

  return true;
}

module.exports = { enviarOTP, verificarOTP };
