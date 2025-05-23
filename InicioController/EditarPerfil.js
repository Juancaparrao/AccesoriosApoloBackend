const pool = require('../db');

async function EditarPerfil(req, res) {
  try {
    const id_usuario = req.user.id_usuario;
    const { nombre, cedula, telefono } = req.body;

    if (!nombre || !cedula || !telefono) {
      return res.status(400).json({
        success: false,
        mensaje: 'Todos los campos son obligatorios.'
      });
    }

    // Validar que no haya otra persona con la misma cédula
    const [cedulaExistente] = await pool.execute(
      'SELECT id_usuario FROM usuario WHERE cedula = ? AND id_usuario != ?',
      [cedula, id_usuario]
    );
    if (cedulaExistente.length > 0) {
      return res.status(409).json({
        success: false,
        mensaje: 'La cédula ya está registrada por otro usuario.'
      });
    }

    // Validar que no haya otra persona con el mismo teléfono
    const [telefonoExistente] = await pool.execute(
      'SELECT id_usuario FROM usuario WHERE telefono = ? AND id_usuario != ?',
      [telefono, id_usuario]
    );
    if (telefonoExistente.length > 0) {
      return res.status(409).json({
        success: false,
        mensaje: 'El teléfono ya está registrado por otro usuario.'
      });
    }

    // Actualizar perfil
    await pool.execute(
      'UPDATE usuario SET nombre = ?, cedula = ?, telefono = ? WHERE id_usuario = ?',
      [nombre, cedula, telefono, id_usuario]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Perfil actualizado correctamente.'
    });

  } catch (error) {
    console.error('Error al editar perfil:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al editar el perfil.'
    });
  }
}

module.exports = { EditarPerfil };
