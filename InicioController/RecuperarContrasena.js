const pool = require('../db');
const bcrypt = require('bcrypt');
const transporter = require('../config/mailer');
const generarHtmlRecuperarContrasena = require('../templates/recuperarCorreo');
const crypto = require('crypto');

const tokenRecuperacionStore = new Map(); // token -> { correo, expiracion }

function generarTokenSeguro() {
  return crypto.randomBytes(32).toString('hex');
}

function contrasenaValida(contrasena) {
  const regex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
  return regex.test(contrasena);
}


// 1. Enviar link de recuperación al correo
async function solicitarRecuperacion(req, res) {
  const { correo } = req.body;

  try {
    const [usuarios] = await pool.execute('SELECT * FROM usuario WHERE correo = ?', [correo]);
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

  if (!datos) {
    return res.status(400).json({
      success: false,
      mensaje: 'El enlace de recuperación es inválido.'
    });
  }

  if (Date.now() > datos.expiracion) {
    tokenRecuperacionStore.delete(token); // eliminar token expirado
    return res.status(400).json({
      success: false,
      mensaje: 'El enlace de recuperación ha expirado.'
    });
  }

  if (!contrasenaValida(nuevaContrasena)) {
    return res.status(400).json({
      success: false,
      mensaje: 'La contraseña debe tener al menos 8 caracteres, una letra mayúscula y un número.'
    });
  }

  try {
    const [rows] = await pool.execute('SELECT contrasena FROM usuario WHERE correo = ?', [datos.correo]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Usuario no encontrado.'
      });
    }

    const contrasenaActualHash = rows[0].contrasena;
    const esIgual = await bcrypt.compare(nuevaContrasena, contrasenaActualHash);

    if (esIgual) {
      return res.status(400).json({
        success: false,
        mensaje: 'La nueva contraseña no puede ser igual a la anterior.'
      });
    }

    const nuevaHash = await bcrypt.hash(nuevaContrasena, 10);
    await pool.execute('UPDATE usuario SET contrasena = ? WHERE correo = ?', [nuevaHash, datos.correo]);
    tokenRecuperacionStore.delete(token);

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
