const pool = require('../db');

async function reactivarUsuario(req, res) {
  const { correo } = req.body;

  if (!correo) {
    return res.status(400).json({
      success: false,
      mensaje: 'El correo es obligatorio.'
    });
  }

  try {
    // Verificar si el usuario existe y está inactivo
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

    if (usuario.estado) {
      return res.status(400).json({
        success: false,
        mensaje: 'El usuario ya está activo.'
      });
    }

    // Cambiar estado a activo
    await pool.execute(
      'UPDATE usuario SET estado = true WHERE id_usuario = ?',
      [usuario.id_usuario]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Usuario reactivado exitosamente.'
    });

  } catch (error) {
    console.error('Error al reactivar usuario:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al reactivar el usuario.'
    });
  }
}

module.exports = { reactivarUsuario };
