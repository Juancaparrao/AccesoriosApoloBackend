const pool = require('../db');
const bcrypt = require('bcrypt');

async function registrarUsuario(nombre, correo, telefono, contrasena, id_rol) {
  const hashedPassword = await bcrypt.hash(contrasena, 10);

  // Insertar en USUARIO
  const [usuarioResult] = await pool.execute(
    'INSERT INTO USUARIO (nombre, correo, telefono, contrasena) VALUES (?, ?, ?, ?)',
    [nombre, correo, telefono, hashedPassword]
  );

  const id_usuario = usuarioResult.insertId;

  // Insertar en USUARIO_ROL
  await pool.execute(
    'INSERT INTO USUARIO_ROL (fk_id_usuario, id_rol) VALUES (?, ?)',
    [id_usuario, id_rol]
  );

  return { id_usuario };
}

module.exports = { registrarUsuario };
