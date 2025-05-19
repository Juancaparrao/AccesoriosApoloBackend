const pool = require('../db');

async function obtenerPerfil(req, res) {
  try {
    const correo = req.user.correo;

    const [result] = await pool.execute(
      'SELECT nombre, correo, cedula, telefono FROM USUARIO WHERE correo = ?',
      [correo]
    );

    if (result.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json({
      mensaje: 'Acceso permitido',
      usuario: result[0]
    });
  } catch (error) {
    console.error('Error en /perfil:', error);
    res.status(500).json({ mensaje: 'Error al obtener el perfil' });
  }
}

module.exports = { obtenerPerfil };
