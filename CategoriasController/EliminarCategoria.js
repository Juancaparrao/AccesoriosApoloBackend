const pool = require('../db');

async function EliminarCategoria(req, res) {
  const { id_categoria } = req.body;

  if (!id_categoria) {
    return res.status(400).json({
      success: false,
      mensaje: 'El ID de la categoría es obligatorio.'
    });
  }

  try {
    // Verificar si la categoría existe
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

    if (!categoria.estado) {
      return res.status(400).json({
        success: false,
        mensaje: 'La categoría ya está inactiva.'
      });
    }

    // Cambiar el estado a inactivo
    await pool.execute(
      'UPDATE CATEGORIA SET estado = false WHERE id_categoria = ?',
      [id_categoria]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Categoría desactivada exitosamente.'
    });

  } catch (error) {
    console.error('Error al desactivar categoría:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al desactivar la categoría.'
    });
  }
}

module.exports = { EliminarCategoria };
