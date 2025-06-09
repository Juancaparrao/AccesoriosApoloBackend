const pool = require('../db');

async function EliminarCalcomania(req, res) {
  try {
    const { id_calcomania } = req.body;

    // Validar que se proporcione el ID
    if (!id_calcomania) {
      return res.status(400).json({
        success: false,
        mensaje: 'El ID de la calcomanía es requerido.'
      });
    }

    // Verificar que la calcomanía existe
    const [calcomania] = await pool.execute(
      'SELECT id_calcomania, estado FROM calcomania WHERE id_calcomania = ?',
      [id_calcomania]
    );

    if (calcomania.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Calcomanía no encontrada.'
      });
    }

    // Verificar si ya está inactiva
    if (!calcomania[0].estado) {
      return res.status(400).json({
        success: false,
        mensaje: 'La calcomanía ya está inactiva.'
      });
    }

    // Cambiar el estado a inactivo (false)
    await pool.execute(
      'UPDATE calcomania SET estado = 0 WHERE id_calcomania = ?',
      [id_calcomania]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Calcomanía eliminada exitosamente.'
    });

  } catch (error) {
    console.error('Error eliminando calcomanía:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor.'
    });
  }
}

module.exports = { EliminarCalcomania };