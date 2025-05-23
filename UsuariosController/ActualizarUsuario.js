const pool = require('../db');
const bcrypt = require('bcrypt');

async function obtenerDatosUsuario(req, res) {
  try {
    const { correo } = req.body;

    const [rows] = await pool.execute(
      'SELECT nombre, correo, telefono, cedula FROM usuario WHERE correo = ?',
      [correo]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      usuario: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener datos del usuario:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al obtener los datos'
    });
  }
}

async function actualizarUsuario(req, res) {
  const { correoOriginal, nombre, correo, telefono, cedula, contrasena } = req.body;

  try {
    // Obtener ID del usuario original
    const [usuarioActual] = await pool.execute(
      'SELECT id_usuario FROM usuario WHERE correo = ?',
      [correoOriginal]
    );

    if (usuarioActual.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    const id_usuario = usuarioActual[0].id_usuario;

    // Validar duplicados (excluyendo su propio ID)
    const [correoExistente] = await pool.execute(
      'SELECT id_usuario FROM usuario WHERE correo = ? AND id_usuario != ?',
      [correo, id_usuario]
    );

    const [cedulaExistente] = await pool.execute(
      'SELECT id_usuario FROM usuario WHERE cedula = ? AND id_usuario != ?',
      [cedula, id_usuario]
    );

    const [telefonoExistente] = await pool.execute(
      'SELECT id_usuario FROM usuario WHERE telefono = ? AND id_usuario != ?',
      [telefono, id_usuario]
    );

    if (correoExistente.length > 0) {
      return res.status(409).json({ success: false, mensaje: 'Ese correo ya está en uso.' });
    }

    if (cedulaExistente.length > 0) {
      return res.status(409).json({ success: false, mensaje: 'Esa cédula ya está registrada.' });
    }

    if (telefonoExistente.length > 0) {
      return res.status(409).json({ success: false, mensaje: 'Ese teléfono ya está registrado.' });
    }

    // Encriptar contraseña si la envían
    let nuevaContrasena = null;
    if (contrasena) {
      const salt = await bcrypt.genSalt(10);
      nuevaContrasena = await bcrypt.hash(contrasena, salt);
    }

    // Actualizar usuario
    await pool.execute(
      `UPDATE usuario SET nombre = ?, correo = ?, telefono = ?, cedula = ?, contrasena = COALESCE(?, contrasena) 
       WHERE id_usuario = ?`,
      [nombre, correo, telefono, cedula, nuevaContrasena, id_usuario]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Usuario actualizado correctamente.'
    });

  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al actualizar el usuario'
    });
  }
}

module.exports = { obtenerDatosUsuario, actualizarUsuario };
