const pool = require('../db');

async function ConsultarCategoria(req, res) {
  try {
    const [categorias] = await pool.execute(`
      SELECT 
        c.id_categoria, 
        c.nombre_categoria, 
        c.descripcion AS descripcion_categoria, 
        c.descuento AS descuento_categoria, 
        c.estado AS estado_categoria,
        s.nombre_subcategoria
      FROM categoria c
      LEFT JOIN subcategoria s ON s.FK_id_categoria = c.id_categoria
      ORDER BY c.id_categoria, s.id_subcategoria
    `);

    const resultado = [];
    const categoriasMap = {};

    for (const fila of categorias) {
      const id = fila.id_categoria;

      if (!categoriasMap[id]) {
        categoriasMap[id] = {
          id_categoria: fila.id_categoria,
          nombre_categoria: fila.nombre_categoria,
          descripcion: fila.descripcion_categoria,
          descuento: fila.descuento_categoria,
          estado: fila.estado_categoria,
          subcategorias: []
        };
        resultado.push(categoriasMap[id]);
      }

      if (fila.nombre_subcategoria) {
        categoriasMap[id].subcategorias.push(fila.nombre_subcategoria);
      }
    }

    return res.status(200).json({
      success: true,
      categorias: resultado
    });

  } catch (error) {
    console.error('❌ Error al consultar categorías con subcategorías:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al obtener la lista de categorías con subcategorías.'
    });
  }
}

module.exports = { ConsultarCategoria };
