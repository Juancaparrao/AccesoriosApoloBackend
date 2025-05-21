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

async function correoExiste(correo) {
  const [rows] = await pool.execute('SELECT id_usuario FROM usuario WHERE correo = ?', [correo]);
  return rows.length > 0;
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
  const { nombre, correo, telefono, contrasena } = req.body;

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({
      success: false,
      mensaje: 'Faltan campos obligatorios.'
    });
  }

  try {
    if (await correoExiste(correo)) {
      return res.status(409).json({
        success: false,
        mensaje: 'Este correo ya está registrado. Intenta con otro.'
      });
    }

    guardarUsuarioPendiente(correo, { nombre, correo, telefono, contrasena });
    await enviarOTP(correo);
    return res.status(200).json({
      success: true,
      mensaje: 'Se envió un código OTP al correo.'
    });
  } catch (error) {
    console.error('Error al solicitar OTP:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error enviando OTP.',
      error: error.message
    });
  }
}

async function reenviarOTP(req, res) {
  const { correo } = req.body;

  if (!correo) {
    return res.status(400).json({
      success: false,
      mensaje: 'El correo es obligatorio.'
    });
  }

  try {
    await enviarOTP(correo);
    return res.status(200).json({
      success: true,
      mensaje: 'Código reenviado con éxito.'
    });
  } catch (error) {
    console.error('Error al reenviar OTP:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al reenviar el código.',
      error: error.message
    });
  }
}

async function verificarOTPHandler(req, res) {
  const { correo, codigo } = req.body;

  if (!verificarOTP(correo, codigo)) {
    return res.status(400).json({
      success: false,
      mensaje: 'Código OTP inválido o expirado.'
    });
  }

  const datos = obtenerUsuarioPendiente(correo);
  if (!datos) {
    return res.status(400).json({
      success: false,
      mensaje: 'No hay datos pendientes para este correo.'
    });
  }

  try {
    const resultado = await registrarUsuario(
      datos.nombre,
      datos.correo,
      datos.telefono,
      datos.contrasena
    );

    eliminarUsuarioPendiente(correo);

    const payload = {
      id_usuario: resultado.id_usuario,
      correo: datos.correo,
      nombre: datos.nombre
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
    });

    await transporter.sendMail({
      from: process.env.CORREO_ORIGEN,
      to: datos.correo,
      subject: '¡Bienvenido a Accesorios Apolo!',
      html: generarHtmlBienvenida(datos.nombre)
    });

    return res.status(200).json({
      success: true,
      mensaje: 'Usuario registrado correctamente.',
      token,
      usuario: payload
    });

  } catch (error) {
    console.error('Error al registrar usuario:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al registrar usuario.',
      error: error.message
    });
  }
}

module.exports = { solicitarOTP, verificarOTPHandler, reenviarOTP };
