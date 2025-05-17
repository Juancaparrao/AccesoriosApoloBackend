const otpStore = new Map();
const generarOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const transporter = require('./config/mailer');
const { registrarUsuario } = require('./Registro');
const usuariosPendientes = new Map();
const jwt = require('jsonwebtoken');
const { generarHtmlOTP, generarHtmlBienvenida } = require('./templates/otpCorreo');



function guardarUsuarioPendiente(correo, datos) {
  usuariosPendientes.set(correo, datos);
}

function obtenerUsuarioPendiente(correo) {
  return usuariosPendientes.get(correo);
}

function eliminarUsuarioPendiente(correo) {
  usuariosPendientes.delete(correo);
}

async function enviarOTP(correo) {
  const codigo = generarOTP();
  otpStore.set(correo, { codigo, expiracion: Date.now() + 5 * 60 * 1000 });

  await transporter.sendMail({
    from: process.env.CORREO_ORIGEN,
    to: correo,
    subject: 'Tu código OTP',
    html: generarHtmlOTP(codigo)
  });
}

function verificarOTP(correo, codigo) {
  const entrada = otpStore.get(correo);
  if (!entrada || entrada.codigo !== codigo || Date.now() > entrada.expiracion) return false;
  otpStore.delete(correo);
  return true;
}

async function solicitarOTP(req, res) {
  const { nombre, correo, telefono, contrasena, id_rol } = req.body;
  if (!nombre || !correo || !contrasena || !id_rol) return res.status(400).json({ mensaje: 'Faltan campos obligatorios' });
  try {
    guardarUsuarioPendiente(correo, { nombre, correo, telefono, contrasena, id_rol });
    await enviarOTP(correo);
    res.json({ mensaje: 'Código OTP enviado al correo' });
  } catch (error) {
    console.error('Error al solicitar OTP:', error);
    res.status(500).json({ mensaje: 'Error enviando OTP' });
  }
}

async function reenviarOTP(req, res) {
  const { correo } = req.body;
  if (!correo) return res.status(400).json({ error: 'El correo es obligatorio.' });
  try {
    await enviarOTP(correo);
    res.status(200).json({ message: 'Código reenviado con éxito.' });
  } catch (error) {
    console.error('Error al reenviar OTP:', error);
    res.status(500).json({ error: 'Error al reenviar el código.' });
  }
}

async function verificarOTPHandler(req, res) {
  const { correo, codigo_otp } = req.body;
  if (!verificarOTP(correo, codigo_otp)) return res.status(400).json({ mensaje: 'OTP inválido o expirado' });

  const datos = obtenerUsuarioPendiente(correo);
  if (!datos) return res.status(400).json({ mensaje: 'No hay datos pendientes para este correo' });

  try {
    const resultado = await registrarUsuario(datos.nombre, datos.correo, datos.telefono, datos.contrasena, datos.id_rol);
    eliminarUsuarioPendiente(correo);

    // Generar el token
    const payload = { id_usuario: resultado.id_usuario, correo: datos.correo, nombre: datos.nombre };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    // Enviar correo de bienvenida
    await transporter.sendMail({
      from: process.env.CORREO_ORIGEN,
      to: datos.correo,
      subject: '¡Bienvenido a Accesorios Apolo!',
      html: generarHtmlBienvenida(datos.nombre)
    });

    res.json({ mensaje: 'Usuario registrado y sesión iniciada', token, usuario: payload });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ mensaje: 'Error al registrar usuario' });
  }
}

module.exports = { solicitarOTP, verificarOTPHandler, reenviarOTP };
