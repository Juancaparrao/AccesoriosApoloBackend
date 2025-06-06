const pool = require('../db');
const bcrypt = require('bcrypt');

async function obtenerDatosUsuario(req, res) {
  try {
    const { correo } = req.body;

    const [rows] = await pool.execute(
      `SELECT u.nombre, u.correo, u.telefono, u.cedula, r.nombre AS rol
       FROM usuario u
       JOIN usuario_rol ur ON u.id_usuario = ur.fk_id_usuario
       JOIN rol r ON ur.id_rol = r.id_rol
       WHERE u.correo = ?`,
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
  const { correoOriginal, nombre, correo, telefono, cedula, contrasena, rol } = req.body;

  // Validación: teléfono obligatorio
  if (!telefono || telefono.trim() === "") {
    return res.status(400).json({
      success: false,
      mensaje: 'El teléfono es obligatorio.'
    });
  }

  try {
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

    // Validaciones de duplicados
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

    // Obtener id del nuevo rol
    const [rolData] = await pool.execute('SELECT id_rol FROM rol WHERE nombre = ?', [rol]);

    if (rolData.length === 0) {
      return res.status(400).json({ success: false, mensaje: 'Rol no válido.' });
    }

    const nuevoRolId = rolData[0].id_rol;

    // Lógica condicional para la contraseña
    const puedeActualizarContrasena = rol === 'gerente' || rol === 'vendedor';

    if (!contrasena || contrasena.trim() === "" || !puedeActualizarContrasena) {
      // Sin cambio de contraseña
      await pool.execute(
        `UPDATE usuario SET nombre = ?, correo = ?, telefono = ?, cedula = ?
         WHERE id_usuario = ?`,
        [nombre, correo, telefono, cedula, id_usuario]
      );
    } else {
      // Con cambio de contraseña permitido
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(contrasena, salt);

      await pool.execute(
        `UPDATE usuario SET nombre = ?, correo = ?, telefono = ?, cedula = ?, contrasena = ?
         WHERE id_usuario = ?`,
        [nombre, correo, telefono, cedula, hashedPassword, id_usuario]
      );
    }

    // Actualizar el rol en la tabla usuario_rol
    await pool.execute(
      `UPDATE usuario_rol SET id_rol = ? WHERE fk_id_usuario = ?`,
      [nuevoRolId, id_usuario]
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
