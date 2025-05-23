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
      'SELECT id_usuario, nombre, correo, telefono, cedula FROM usuario WHERE correo LIKE ?',
      [`${filtro}%`]
    );

    return res.status(200).json({
      success: true,
      usuarios
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
