const pool = require('../db');

async function ConsultarSubcategoriasPorCategoria(req, res) {
  try {
    console.log("=== DEBUG BACKEND - Consultar Subcategorías por Nombre de Categoría ===");
    // El nombre de la categoría se espera en los parámetros de la URL, por ejemplo: /subcategorias-por-categoria-por-nombre/Electronicos
    const { nombre_categoria } = req.params; 

    // 1. Validar que el nombre de la categoría esté presente
    if (!nombre_categoria || typeof nombre_categoria !== 'string' || nombre_categoria.trim() === '') {
      return res.status(400).json({
        success: false,
        mensaje: 'Nombre de categoría no proporcionado o no es válido.'
      });
    }

    // 2. Ejecutar la consulta SQL para obtener las subcategorías.
    // Realizamos un JOIN con la tabla CATEGORIA para filtrar por nombre_categoria
    const [subcategorias] = await pool.execute(
      `SELECT
         s.nombre_subcategoria,
         s.url_imagen
       FROM
         subcategoria s
       JOIN
         categoria c ON s.FK_id_categoria = c.id_categoria
       WHERE
         c.nombre_categoria = ? AND s.estado = TRUE`,
      [nombre_categoria]
    );

    // 3. Verificar si se encontraron subcategorías
    if (subcategorias.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: `No se encontraron subcategorías para la categoría con nombre "${nombre_categoria}".`
      });
    }

    // 4. Devolver la respuesta con las subcategorías encontradas
    return res.status(200).json({
      success: true,
      mensaje: `Subcategorías de la categoría "${nombre_categoria}" consultadas exitosamente.`,
      subcategorias: subcategorias
    });

  } catch (error) {
    console.error('Error al consultar subcategorías por nombre de categoría:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor al consultar subcategorías por nombre de categoría.'
    });
  }
}

module.exports = {
  ConsultarSubcategoriasPorCategoria
};
