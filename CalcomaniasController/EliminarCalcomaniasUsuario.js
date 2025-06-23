const pool = require('../db');

async function EliminarCalcomaniaUsuario(req, res) {
  try {
    const { id_calcomania } = req.params;

    // Validar que se proporcione el ID
    if (!id_calcomania) {
      return res.status(400).json({
        success: false,
        mensaje: 'El ID de la calcomanía es requerido.'
      });
    }

    // Verificar si la calcomanía existe
    const [calcomaniaExistente] = await pool.execute(
      'SELECT id_calcomania, nombre FROM calcomania WHERE id_calcomania = ?',
      [id_calcomania]
    );

    if (calcomaniaExistente.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'La calcomanía no existe.'
      });
    }

    // Eliminar la calcomanía
    const [resultado] = await pool.execute(
      'DELETE FROM calcomania WHERE id_calcomania = ?',
      [id_calcomania]
    );

    if (resultado.affectedRows === 0) {
      return res.status(500).json({
        success: false,
        mensaje: 'No se pudo eliminar la calcomanía.'
      });
    }

    return res.status(200).json({
      success: true,
      mensaje: `Calcomanía "${calcomaniaExistente[0].nombre}" eliminada exitosamente.`,
      id_eliminado: parseInt(id_calcomania)
    });

  } catch (error) {
    console.error('Error eliminando calcomanía:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor.'
    });
  }
}

module.exports = { EliminarCalcomaniaUsuario };