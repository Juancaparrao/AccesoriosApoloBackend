const pool = require('../db');

async function eliminarUsuario(req, res) {
  const { correo } = req.body;

  if (!correo) {
    return res.status(400).json({
      success: false,
      mensaje: 'El correo es obligatorio.'
    });
  }

  try {
    // Verificar que el usuario existe y está activo
    const [usuarios] = await pool.execute(
      'SELECT id_usuario, estado FROM usuario WHERE correo = ?',
      [correo]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Usuario no encontrado.'
      });
    }

    const usuario = usuarios[0];

    if (!usuario.estado) {
      return res.status(400).json({
        success: false,
        mensaje: 'El usuario ya está inactivo.'
      });
    }

    // Cambiar estado a inactivo
    await pool.execute(
      'UPDATE usuario SET estado = false WHERE id_usuario = ?',
      [usuario.id_usuario]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Usuario desactivado exitosamente.'
    });

  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al desactivar el usuario.'
    });
  }
}

module.exports = { eliminarUsuario };
