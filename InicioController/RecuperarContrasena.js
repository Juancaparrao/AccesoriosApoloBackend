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
    if (usuarios.length === 0) return res.status(404).json({ mensaje: 'Correo no registrado' });

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

    res.json({ mensaje: 'Enlace de recuperación enviado al correo' });
  } catch (error) {
    console.error('Error al enviar enlace:', error);
    res.status(500).json({ mensaje: 'Error enviando enlace de recuperación' });
  }
}

// 2. Cambiar contraseña usando el token
async function cambiarContrasena(req, res) {
  const { token, nuevaContrasena } = req.body;
  const datos = tokenRecuperacionStore.get(token);

  if (!datos || Date.now() > datos.expiracion) {
    return res.status(400).json({ mensaje: 'Token inválido o expirado' });
  }

  try {
    const hash = await bcrypt.hash(nuevaContrasena, 10);
    await pool.execute('UPDATE USUARIO SET contrasena = ? WHERE correo = ?', [hash, datos.correo]);
    tokenRecuperacionStore.delete(token); // eliminar token usado
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error actualizando contraseña:', error);
    res.status(500).json({ mensaje: 'Error al cambiar la contraseña' });
  }
}

module.exports = {
  solicitarRecuperacion,
  cambiarContrasena
};