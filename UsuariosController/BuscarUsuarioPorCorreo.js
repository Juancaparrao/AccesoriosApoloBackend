const pool = require('../db');

async function buscarUsuarioPorCorreo(req, res) {
  try {
    const { filtro } = req.query;

    if (!filtro || filtro.trim() === '') {
      return res.status(400).json({
        success: false,
        mensaje: 'Debe proporcionar un filtro para buscar.'
      });
    }

    const [usuarios] = await pool.execute(
      `SELECT  u.nombre, u.correo, u.telefono, u.cedula, u.estado, r.nombre AS rol
       FROM usuario u
       JOIN usuario_rol ur ON u.id_usuario = ur.fk_id_usuario
       JOIN rol r ON ur.id_rol = r.id_rol
       WHERE u.correo LIKE ?`,
      [`${filtro}%`]
    );

    const usuariosFormateados = usuarios.map(usuario => ({
      nombre: usuario.nombre,
      correo: usuario.correo,
      telefono: usuario.telefono,
      cedula: usuario.cedula,
      rol: usuario.rol,
      estado: usuario.estado ? 'Activo' : 'Inactivo'
    }));

    return res.status(200).json({
      success: true,
      usuarios: usuariosFormateados
    });
  } catch (error) {
    console.error('Error al buscar usuarios por correo:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al buscar usuarios.'
    });
  }
}

module.exports = { buscarUsuarioPorCorreo };
