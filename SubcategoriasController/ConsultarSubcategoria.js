const pool = require('../db');

async function ConsultarSubcategoria(req, res) {
  try {
    const [subcategorias] = await pool.execute(`
      SELECT 
        s.id_subcategoria,
        s.nombre_subcategoria,
        s.descripcion,
        s.descuento,
        s.url_imagen,
        s.estado,
        c.id_categoria,
        c.nombre_categoria
      FROM subcategoria s
      JOIN categoria c ON s.FK_id_categoria = c.id_categoria
    `);

    return res.status(200).json({
      success: true,
      subcategorias: subcategorias
    });

  } catch (error) {
    console.error('Error al consultar subcategorías:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al obtener la lista de subcategorías.'
    });
  }
}

module.exports = { ConsultarSubcategoria };
