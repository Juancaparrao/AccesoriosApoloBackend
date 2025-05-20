const pool = require('../db');
const bcrypt = require('bcrypt');
const transporter = require('./config/mailer');
const generarHtmlRecuperarContrasena = require('./templates/recuperarCorreo');
const crypto = require('crypto');

const tokenRecuperacionStore = new Map(); // token -> { correo, expiracion }

function generarTokenSeguro() {
  return crypto.randomBytes(32).toString('hex');
}

// 1. Enviar link de recuperación al correo
async function solicitarRecuperacion(req, res) {
  const { correo } = req.body;

  try {
    const [usuarios] = await pool.execute('SELECT * FROM USUARIO WHERE correo = ?', [correo]);
    if (usuarios.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'El correo no está registrado en el sistema.'
      });
    }

    const token = generarTokenSeguro();
    const expiracion = Date.now() + 15 * 60 * 1000; // 15 minutos
    tokenRecuperacionStore.set(token, { correo, expiracion });

    const link = `http://localhost:5173/change-password?token=${token}`;

    await transporter.sendMail({
      from: process.env.CORREO_ORIGEN,
      to: correo,
      subject: 'Recuperación de contraseña',
      html: generarHtmlRecuperarContrasena(link)
    });

    return res.status(200).json({
      success: true,
      mensaje: 'Se envió un enlace de recuperación al correo electrónico.'
    });

  } catch (error) {
    console.error('Error al enviar enlace:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Ocurrió un error al enviar el enlace de recuperación.',
      error: error.message
    });
  }
}

// 2. Cambiar contraseña usando el token
async function cambiarContrasena(req, res) {
  const { token, nuevaContrasena } = req.body;
  const datos = tokenRecuperacionStore.get(token);

  if (!datos || Date.now() > datos.expiracion) {
    return res.status(400).json({
      success: false,
      mensaje: 'El enlace de recuperación es inválido o ha expirado.'
    });
  }

  try {
    const hash = await bcrypt.hash(nuevaContrasena, 10);
    await pool.execute('UPDATE USUARIO SET contrasena = ? WHERE correo = ?', [hash, datos.correo]);
    tokenRecuperacionStore.delete(token); // eliminar token usado

    return res.status(200).json({
      success: true,
      mensaje: 'La contraseña se actualizó correctamente.'
    });

  } catch (error) {
    console.error('Error actualizando contraseña:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Ocurrió un error al cambiar la contraseña.',
      error: error.message
    });
  }
}

module.exports = {
  solicitarRecuperacion,
  cambiarContrasena
};
