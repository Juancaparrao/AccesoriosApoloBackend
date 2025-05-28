const pool = require('../db');

async function ReactivarCategoria(req, res) {
  const { id_categoria } = req.body;

  if (!id_categoria) {
    return res.status(400).json({
      success: false,
      mensaje: 'El ID de la categoría es obligatorio.'
    });
  }

  try {
    // Verificar si la categoría existe y está inactiva
    const [categorias] = await pool.execute(
      'SELECT estado FROM CATEGORIA WHERE id_categoria = ?',
      [id_categoria]
    );

    if (categorias.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Categoría no encontrada.'
      });
    }

    const categoria = categorias[0];

    if (categoria.estado) {
      return res.status(400).json({
        success: false,
        mensaje: 'La categoría ya está activa.'
      });
    }

    // Reactivar categoría (estado = true)
    await pool.execute(
      'UPDATE CATEGORIA SET estado = true WHERE id_categoria = ?',
      [id_categoria]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Categoría reactivada exitosamente.'
    });

  } catch (error) {
    console.error('Error al reactivar categoría:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al reactivar la categoría.'
    });
  }
}

module.exports = { ReactivarCategoria };
