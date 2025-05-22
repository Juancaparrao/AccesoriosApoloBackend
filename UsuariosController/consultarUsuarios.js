const pool = require('../db');

async function consultarUsuarios(req, res) {
  try {
    const [usuarios] = await pool.execute(`
      SELECT cedula, nombre, telefono, correo, contrasena, estado 
      FROM usuario
    `);

    const usuariosFormateados = usuarios.map(usuario => ({
      cedula: usuario.cedula,
      nombre: usuario.nombre,
      telefono: usuario.telefono,
      correo: usuario.correo,
      contrasena: usuario.contrasena,
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
