const otpStore = new Map();
const generarOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const transporter = require('../config/mailer');
const { registrarUsuario } = require('./Registro');
const usuariosPendientes = new Map();
const jwt = require('jsonwebtoken');
const { generarHtmlOTP, generarHtmlBienvenida } = require('../templates/otpCorreo');
const pool = require('../db');

// 👉 Validación de contraseña segura
function contrasenaValida(contrasena) {
  const regex = /^(?=.*[A-Z]).{8,}$/;
  return regex.test(contrasena);
}

// 👉 Manejo del mapa de usuarios pendientes
function guardarUsuarioPendiente(correo, datos) {
  usuariosPendientes.set(correo, datos);
}

function obtenerUsuarioPendiente(correo) {
  return usuariosPendientes.get(correo);
}

function eliminarUsuarioPendiente(correo) {
  usuariosPendientes.delete(correo);
}

// 👉 Verificación de existencia previa
async function correoExiste(correo) {
  const [rows] = await pool.execute('SELECT id_usuario FROM usuario WHERE correo = ?', [correo]);
  return rows.length > 0;
}

async function telefonoExiste(telefono) {
  const [rows] = await pool.execute('SELECT id_usuario FROM usuario WHERE telefono = ?', [telefono]);
  return rows.length > 0;
}

// ✅ ASIGNAR ROL: evita insertar duplicados
async function asignarRolUsuario(idUsuario, idRol) {
  const [rows] = await pool.query(
    'SELECT * FROM usuario_rol WHERE fk_id_usuario = ? AND id_rol = ?',
    [idUsuario, idRol]
  );

  if (rows.length === 0) {
    const query = 'INSERT INTO usuario_rol (fk_id_usuario, id_rol) VALUES (?, ?)';
    await pool.query(query, [idUsuario, idRol]);
  }
}

// 👉 Enviar correo con OTP
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

// 👉 Verificar OTP
function verificarOTP(correo, codigo) {
  const entrada = otpStore.get(correo);

  if (!entrada) return 'invalido';
  if (Date.now() > entrada.expiracion) {
    otpStore.delete(correo);
    return 'expirado';
  }
  if (entrada.codigo !== codigo) return 'invalido';

  otpStore.delete(correo);
  return 'valido';
}

// 👉 Solicitar OTP
async function solicitarOTP(req, res) {
  const { nombre, correo, telefono, contrasena } = req.body;

  if (!nombre || !correo || !telefono || !contrasena) {
    return res.status(400).json({
      success: false,
      mensaje: 'Faltan campos obligatorios.'
    });
  }

  if (!contrasenaValida(contrasena)) {
    return res.status(400).json({
      success: false,
      mensaje: 'La contraseña no cumple con los requisitos de seguridad.'
    });
  }

  try {
    if (await correoExiste(correo)) {
      return res.status(409).json({
        success: false,
        mensaje: 'Este correo ya está registrado. Intenta con otro.'
      });
    }

    if (await telefonoExiste(telefono)) {
      return res.status(409).json({
        success: false,
        mensaje: 'Este número de teléfono ya está registrado. Intenta con otro.'
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

// 👉 Reenviar OTP
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

// ✅ Verificar OTP y registrar usuario
async function verificarOTPHandler(req, res) {
  const { correo, codigo } = req.body;

  const resultado = verificarOTP(correo, codigo);

  if (resultado === 'expirado') {
    return res.status(400).json({
      success: false,
      mensaje: 'El código OTP ha expirado.'
    });
  }

  if (resultado === 'invalido') {
    return res.status(400).json({
      success: false,
      mensaje: 'Código OTP inválido.'
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

    // Asignar rol por defecto (cliente = 1), evitando duplicados
    await asignarRolUsuario(resultado.id_usuario, 1);

    // Obtener nombre del rol
    const [rolRows] = await pool.query(`
      SELECT R.nombre AS nombre_rol
      FROM usuario_rol UR
      JOIN rol R ON UR.id_rol = R.id_rol
      WHERE UR.fk_id_usuario = ?
    `, [resultado.id_usuario]);

    const nombreRol = rolRows.length > 0 ? rolRows[0].nombre_rol : null;

    eliminarUsuarioPendiente(correo);

    const payload = {
      id_usuario: resultado.id_usuario,
      correo: datos.correo,
      nombre: datos.nombre,
      rol: nombreRol
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

module.exports = {
  solicitarOTP,
  verificarOTPHandler,
  reenviarOTP
};
