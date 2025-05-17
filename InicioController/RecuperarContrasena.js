const pool = require('../db');
const bcrypt = require('bcrypt');
const transporter = require('./config/mailer');
const generarHtmlRecuperarContrasena = require('./templates/recuperarCorreo');

const otpRecuperacionStore = new Map();
const generarOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// 1. Enviar OTP al correo
async function solicitarRecuperacion(req, res) {
  const { correo } = req.body;
  try {
    const [usuarios] = await pool.execute('SELECT * FROM USUARIO WHERE correo = ?', [correo]);
    if (usuarios.length === 0) return res.status(404).json({ mensaje: 'Correo no registrado' });

    const codigo = generarOTP();
    otpRecuperacionStore.set(correo, { codigo, expiracion: Date.now() + 5 * 60 * 1000, verificado: false });

    await transporter.sendMail({
      from: process.env.CORREO_ORIGEN,
      to: correo,
      subject: 'Código de recuperación',
      html: generarHtmlRecuperarContrasena(codigo)
    });

    res.json({ mensaje: 'Código OTP enviado al correo' });
  } catch (error) {
    console.error('Error al enviar OTP:', error);
    res.status(500).json({ mensaje: 'Error enviando OTP' });
  }
}

// 2. Verificar código OTP
function verificarCodigo(req, res) {
  const { correo, codigo_otp } = req.body;
  const entrada = otpRecuperacionStore.get(correo);

  if (!entrada || entrada.codigo !== codigo_otp || Date.now() > entrada.expiracion) {
    return res.status(400).json({ mensaje: 'Código inválido o expirado' });
  }

  entrada.verificado = true;
  res.json({ mensaje: 'Código verificado correctamente' });
}

// 3. Cambiar contraseña si OTP fue verificado
async function cambiarContrasena(req, res) {
  const { correo, nuevaContrasena } = req.body;
  const entrada = otpRecuperacionStore.get(correo);

  if (!entrada || !entrada.verificado) {
    return res.status(403).json({ mensaje: 'Código no verificado' });
  }

  try {
    const hash = await bcrypt.hash(nuevaContrasena, 10);
    await pool.execute('UPDATE USUARIO SET contrasena = ? WHERE correo = ?', [hash, correo]);
    otpRecuperacionStore.delete(correo); // limpiar memoria
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error actualizando contraseña:', error);
    res.status(500).json({ mensaje: 'Error al cambiar la contraseña' });
  }
}

module.exports = {
  solicitarRecuperacion,
  verificarCodigo,
  cambiarContrasena
};
