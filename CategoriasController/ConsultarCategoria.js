const pool = require('../db');

async function ConsultarCategoria(req, res) {
  try {
    const [categorias] = await pool.execute(`
      SELECT id_categoria, nombre_categoria, descripcion, descuento, estado
      FROM CATEGORIA
    `);

    return res.status(200).json({
      success: true,
      categorias: categorias
    });

  } catch (error) {
    console.error('Error al consultar categorías:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al obtener la lista de categorías.'
    });
  }
}

module.exports = { ConsultarCategoria };
