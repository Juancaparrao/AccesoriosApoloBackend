const jwt = require('jsonwebtoken');
const pool = require('../db');
const bcrypt = require('bcrypt');

async function iniciarSesion(correo, contrasena) {
const [rows] = await pool.execute('SELECT * FROM usuario WHERE correo = ? AND estado = true', [correo]);
  
  if (rows.length === 0) {
    throw new Error('Usuario no encontrado'); // Correo no registrado
  }

  const usuario = rows[0];
  const esValida = await bcrypt.compare(contrasena, usuario.contrasena);

  if (!esValida) {
    throw new Error('Correo o contraseña incorrectos'); // Contraseña incorrecta
  }

  const payload = {
    id_usuario: usuario.id_usuario,
    correo: usuario.correo,
    nombre: usuario.nombre
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });

  return { token, usuario: payload };
}

async function login(req, res) {
  const { correo, contrasena } = req.body;

  try {
    const { token, usuario } = await iniciarSesion(correo, contrasena);
    res.json({ mensaje: 'Login exitoso', token, usuario });
  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(401).json({ mensaje: error.message });
  }
}

module.exports = { login };
