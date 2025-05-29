const pool = require('../db');

async function BuscarSubcategoriaPorNombre(req, res) {
  try {
    const { nombre } = req.query;

    const [subcategorias] = await pool.execute(`
      SELECT s.*, c.nombre_categoria 
      FROM subcategoria s
      JOIN categoria c ON s.FK_id_categoria = c.id_categoria
      WHERE s.nombre_subcategoria LIKE ?
    `, [`%${nombre}%`]);

    return res.status(200).json({
      success: true,
      subcategorias
    });

  } catch (error) {
    console.error('Error al buscar subcategoría:', error);
    return res.status(500).json({ success: false, mensaje: 'Error interno al buscar subcategoría.' });
  }
}

module.exports = { BuscarSubcategoriaPorNombre };
