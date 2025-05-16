const pool = require('./db');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
require('dotenv').config();

async function registrarUsuario(nombre, correo, telefono, contrasena, id_rol) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const hashedPassword = await bcrypt.hash(contrasena, 10);

    const [usuarioResult] = await conn.execute(
      `INSERT INTO USUARIO (nombre, correo, telefono, contrasena)
       VALUES (?, ?, ?, ?)`,
      [nombre, correo, telefono, hashedPassword]
    );

    const id_usuario = usuarioResult.insertId;

    await conn.execute(
      `INSERT INTO USUARIO_ROL (fk_id_usuario, id_rol) VALUES (?, ?)`,
      [id_usuario, id_rol]
    );

    await conn.commit();

    // ✅ Enviar correo de bienvenida después del commit
    await enviarCorreoBienvenida(correo, nombre);

    return { id_usuario };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function enviarCorreoBienvenida(correo, nombre) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #f2f2f2; padding: 40px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
        
        <div style="text-align: center;">
          <img src="https://i.imgur.com/vf6Lg64.png" alt="Logo Accesorios Apolo" style="max-width: 120px; margin-bottom: 20px;" />
        </div>

        <h2 style="color: #333333; text-align: center;">¡Bienvenido, ${nombre}!</h2>

        <p style="font-size: 16px; color: #555555; text-align: center;">
          Nos alegra tenerte con nosotros. Gracias por registrarte en <strong>Accesorios Apolo</strong>, tu tienda confiable de accesorios de calidad.
        </p>

        <div style="margin: 30px 0; text-align: center;">
          <p style="font-size: 16px; color: #0077cc;">A partir de ahora podrás:</p>
          <ul style="list-style: none; padding: 0; color: #555555; font-size: 15px;">
            <li>✓ Acceder a promociones exclusivas</li>
            <li>✓ Realizar compras más rápido</li>
            <li>✓ Hacer seguimiento a tus pedidos</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 40px;">
          <a href="https://accesorios-apolo-frontend.vercel.app/" style="background-color: #0077cc; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-size: 16px;">
            Visita nuestra tienda
          </a>
        </div>

        <hr style="margin: 40px 0; border: none; border-top: 1px solid #eeeeee;" />

        <p style="text-align: center; font-size: 12px; color: #aaaaaa;">
          Este es un mensaje automático de bienvenida. Si tienes preguntas, contáctanos en 
          <a href="mailto:soporte@accesoriosapolo.com">soporte@accesoriosapolo.com</a>.
        </p>

      </div>
    </div>
  `;

  console.log('Enviando correo de bienvenida a:', correo);

  await transporter.sendMail({
    from: `"Accesorios Apolo" <${process.env.EMAIL_USER}>`,
    to: correo,
    subject: '¡Bienvenido a Accesorios Apolo!',
    html
  });
}

module.exports = { registrarUsuario };
