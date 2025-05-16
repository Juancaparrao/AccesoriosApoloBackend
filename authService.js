const pool = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function iniciarSesion(correo, contrasena) {
  const [rows] = await pool.execute(
    `SELECT * FROM USUARIO WHERE correo = ?`,
    [correo]
  );

  if (rows.length === 0) {
    throw new Error('Usuario no encontrado');
  }

  const usuario = rows[0];

  const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);
  if (!contrasenaValida) {
    throw new Error('Contraseña incorrecta');
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

module.exports = { iniciarSesion };
