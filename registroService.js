const pool = require('./db');
const bcrypt = require('bcrypt');

async function registrarUsuario(nombre, correo, telefono, contrasena, id_rol) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 🔐 Encriptar la contraseña antes de guardar
    const hashedPassword = await bcrypt.hash(contrasena, 10);

    const [usuarioResult] = await conn.execute(
      `INSERT INTO USUARIO (nombre, correo, telefono, contrasena)
       VALUES (?, ?, ?, ?)`,
      [nombre, correo, telefono, hashedPassword] // usar la contraseña hasheada
    );

    const id_usuario = usuarioResult.insertId;

    await conn.execute(
      `INSERT INTO USUARIO_ROL (fk_id_usuario, id_rol) VALUES (?, ?)`,
      [id_usuario, id_rol]
    );

    await conn.commit();
    return { id_usuario };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = { registrarUsuario };
