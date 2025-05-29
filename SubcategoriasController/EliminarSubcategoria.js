const pool = require('../db');

async function EliminarSubcategoria(req, res) {
  try {
    const { id_subcategoria } = req.body;

    await pool.execute(`
      UPDATE subcategoria SET estado = 0 WHERE id_subcategoria = ?
    `, [id_subcategoria]);

    return res.status(200).json({ success: true, mensaje: 'Subcategoría eliminada correctamente.' });

  } catch (error) {
    console.error('Error al eliminar subcategoría:', error);
    return res.status(500).json({ success: false, mensaje: 'Error interno al eliminar subcategoría.' });
  }
}

module.exports = { EliminarSubcategoria };
