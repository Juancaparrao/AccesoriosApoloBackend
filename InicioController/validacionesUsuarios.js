const pool = require('../db');

async function validarGerente(req, res) {
  try {
    const id_usuario = req.user.id_usuario;

    const [rows] = await pool.execute(
      'SELECT * FROM usuario_rol WHERE fk_id_usuario = ? AND id_rol = 2',
      [id_usuario]
    );

    const esGerente = rows.length > 0;

    res.status(200).json({
      success: true,
      esGerente,
            mensaje: 'si es gerente.'
    });
  } catch (error) {
    console.error('Error al validar gerente:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno al validar el rol de gerente.'
    });
  }
}

module.exports = { validarGerente };
