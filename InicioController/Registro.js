const pool = require('../db');
const bcrypt = require('bcrypt');

async function registrarUsuario(nombre, correo, telefono, contrasena) {
  const hashedPassword = await bcrypt.hash(contrasena, 10);

  // Insertar en USUARIO con estado = true
  const [usuarioResult] = await pool.execute(
    'INSERT INTO usuario (nombre, correo, telefono, contrasena, estado) VALUES (?, ?, ?, ?, ?)',
    [nombre, correo, telefono, hashedPassword, true] // 👈 aquí se agrega estado
  );

  const id_usuario = usuarioResult.insertId;

  // Asignar rol fijo: 1
  const rolPorDefecto = 1;
  await pool.execute(
    'INSERT INTO usuario_rol (fk_id_usuario, id_rol) VALUES (?, ?)',
    [id_usuario, rolPorDefecto]
  );

  return {
    id_usuario
  };
}

module.exports = { registrarUsuario };
