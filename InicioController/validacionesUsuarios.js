const pool = require('../db');

async function validarGerente(req, res) {
  try {
    const id_usuario = req.user.id_usuario;

    const [rows] = await pool.execute(
      `SELECT r.nombre AS nombre_rol
       FROM usuario_rol ur
       JOIN rol r ON ur.id_rol = r.id_rol
       WHERE ur.fk_id_usuario = ?`,
      [id_usuario]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        esGerente: false,
        nombreRol: null,
        mensaje: 'El usuario no tiene un rol asignado.'
      });
    }

    // Verificamos si alguno de sus roles es "gerente"
    const esGerente = rows.some(row => row.nombre_rol.toLowerCase() === 'gerente');
    const nombreRol = rows.map(r => r.nombre_rol); // Puede tener varios roles

    res.status(200).json({
      success: true,
      esGerente,
      nombreRol,
      mensaje: esGerente ? 'Es gerente.' : 'No es gerente.'
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
