const pool = require('../db');

async function BuscarCategoriaPorNombre(req, res) {
  try {
    const { filtro } = req.query;

    if (!filtro || filtro.trim() === '') {
      return res.status(400).json({
        success: false,
        mensaje: 'Debe proporcionar un filtro para buscar.'
      });
    }

    const [categorias] = await pool.execute(
      `SELECT id_categoria, nombre_categoria, descripcion, estado
       FROM categoria
       WHERE nombre_categoria LIKE ?`,
      [`${filtro}%`]
    );

    const resultados = categorias.map(categoria => ({
      id_categoria: categoria.id_categoria,
      nombre_categoria: categoria.nombre_categoria,
      descripcion: categoria.descripcion,
      estado: categoria.estado ? 'Activo' : 'Inactivo'
    }));

    return res.status(200).json({
      success: true,
      categorias: resultados
    });

  } catch (error) {
    console.error('Error al buscar categorías por nombre:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al buscar categorías.'
    });
  }
}

module.exports = { BuscarCategoriaPorNombre };
