// controllers/productosController.js

const pool = require('../db'); // Suponiendo que tienes un archivo de configuración de base de datos

async function obtenerProductosPorCategoria(req, res) {
  const { nombre_categoria } = req.params;
  try {
    const query = `
      SELECT
          p.referencia,
          p.nombre,
          p.marca,
          pi.url_imagen,
          p.promedio_calificacion AS calificacion,
          p.descuento,
          p.precio_descuento,
          p.precio_unidad
      FROM
          producto p
      JOIN
          categoria c ON p.fk_id_categoria = c.id_categoria
      LEFT JOIN
          producto_imagen pi ON p.referencia = pi.fk_referencia_producto
      WHERE
          c.nombre_categoria = ? AND p.estado = TRUE AND p.stock > 0 -- ¡Aquí se añade la condición de stock!
      GROUP BY p.referencia;
    `;

    const [rows] = await pool.execute(query, [nombre_categoria]);

    const productosFormateados = rows.map(row => {
      const producto = {
        referencia: row.referencia,
        nombre: row.nombre,
        marca: row.marca,
        url_imagen: row.url_imagen,
        calificacion: parseFloat(row.calificacion),
        precio_unidad: parseFloat(row.precio_unidad),
      };

      if (row.precio_descuento !== null) {
        producto.precio_descuento = parseFloat(row.precio_descuento);
        producto.descuento = row.descuento ? `${row.descuento}%` : null;
      }

      return producto;
    });

    if (productosFormateados.length === 0) {
      return res.status(404).json({ mensaje: `No se encontraron productos disponibles para la categoría '${nombre_categoria}'.` });
    }

    res.status(200).json(productosFormateados);
  } catch (error) {
    console.error(`Error al obtener productos para la categoría ${nombre_categoria}:`, error);
    res.status(500).json({ mensaje: 'No se pudieron obtener los productos de la categoría.' });
  }
}

module.exports = {
  obtenerProductosPorCategoria
};