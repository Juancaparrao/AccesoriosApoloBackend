const pool = require('../db');
const bcrypt = require('bcrypt');

async function registrarUsuario(nombre, correo, telefono, contrasena) {
  const hashedPassword = await bcrypt.hash(contrasena, 10);

  // Insertar en USUARIO
  const [usuarioResult] = await pool.execute(
    'INSERT INTO USUARIO (nombre, correo, telefono, contrasena) VALUES (?, ?, ?, ?)',
    [nombre, correo, telefono, hashedPassword]
  );

  const id_usuario = usuarioResult.insertId;

  // Asignar rol fijo: 1
  const rolPorDefecto = 1;
  await pool.execute(
    'INSERT INTO USUARIO_ROL (fk_id_usuario, id_rol) VALUES (?, ?)',
    [id_usuario, rolPorDefecto]
  );

  return { id_usuario };
}

module.exports = { registrarUsuario };