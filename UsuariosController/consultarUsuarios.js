const pool = require('../db');

async function consultarUsuarios(req, res) {
  try {
    const [usuarios] = await pool.execute(`
      SELECT u.cedula, u.nombre, u.telefono, u.correo, u.estado,
      r.nombre AS rol
      FROM usuario u
      JOIN usuario_rol ur ON u.id_usuario = ur.fk_id_usuario
      JOIN rol r ON ur.id_rol = r.id_rol
    `);

    const usuariosFormateados = usuarios.map(usuario => ({
      cedula: usuario.cedula,
      nombre: usuario.nombre,
      correo: usuario.correo,
      telefono: usuario.telefono,
      rol: usuario.rol,
      estado: usuario.estado ? 'Activo' : 'Inactivo'
    }));

    return res.status(200).json({
      success: true,
      usuarios: usuariosFormateados
    });

  } catch (error) {
    console.error('Error al consultar usuarios:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al obtener la lista de usuarios.'
    });
  }
}

module.exports = { consultarUsuarios };
