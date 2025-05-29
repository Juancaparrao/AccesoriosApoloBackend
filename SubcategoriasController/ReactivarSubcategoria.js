const pool = require('../db');

async function ReactivarSubcategoria(req, res) {
  try {
    const { id_subcategoria } = req.body;

    await pool.execute(`
      UPDATE subcategoria SET estado = 1 WHERE id_subcategoria = ?
    `, [id_subcategoria]);

    return res.status(200).json({ success: true, mensaje: 'Subcategoría reactivada correctamente.' });

  } catch (error) {
    console.error('Error al reactivar subcategoría:', error);
    return res.status(500).json({ success: false, mensaje: 'Error interno al reactivar subcategoría.' });
  }
}

module.exports = { ReactivarSubcategoria };
