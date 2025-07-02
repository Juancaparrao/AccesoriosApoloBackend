// controllers/productosController.js

const pool = require('../db'); // Asegúrate de que la ruta a tu conexión DB sea correcta

async function obtenerProductosPorSubcategoria(req, res) {
  // Asegúrate de que este nombre (nombre_subcategoria) coincida con el nombre del parámetro en tu ruta.
  const { nombre_subcategoria } = req.params; 
  try {
    const query = `
      SELECT
          p.referencia,
          p.nombre,
          p.marca,
          -- **CAMBIO AQUÍ: Usamos MIN() para seleccionar una única url_imagen**
          MIN(pi.url_imagen) AS url_imagen,
          p.promedio_calificacion AS calificacion,
          p.descuento,
          p.precio_descuento,
          p.precio_unidad
      FROM
          producto p
      JOIN
          subcategoria s ON p.fk_id_subcategoria = s.id_subcategoria
      LEFT JOIN
          producto_imagen pi ON p.referencia = pi.fk_referencia_producto
      WHERE
          s.nombre_subcategoria = ?
          AND p.estado = TRUE
          AND p.stock > 0
      GROUP BY
          p.referencia, -- Agrupamos por la referencia del producto
          p.nombre,
          p.marca,
          p.promedio_calificacion,
          p.descuento,
          p.precio_descuento,
          p.precio_unidad; -- Es buena práctica incluir todas las columnas no agregadas en GROUP BY
    `;

    const [rows] = await pool.execute(query, [nombre_subcategoria]);

    const productosFormateados = rows.map(row => {
      const producto = {
        referencia: row.referencia,
        nombre: row.nombre,
        marca: row.marca,
        url_imagen: row.url_imagen,
        calificacion: parseFloat(row.calificacion),
        precio_unidad: parseFloat(row.precio_unidad),
      };

      // Si hay precio_descuento, entonces agregamos el precio_descuento y el descuento
      if (row.precio_descuento !== null) {
        producto.precio_descuento = parseFloat(row.precio_descuento);
        producto.descuento = row.descuento ? `${row.descuento}%` : null;
      }

      return producto;
    });

    if (productosFormateados.length === 0) {
      return res.status(404).json({ mensaje: `No se encontraron productos disponibles para la subcategoría '${nombre_subcategoria}'.` });
    }

    res.status(200).json(productosFormateados);
  } catch (error) {
    // **CAMBIO AQUÍ: Corregido a nombre_subcategoria para el mensaje de error**
    console.error(`Error al obtener productos para la subcategoría ${nombre_subcategoria}:`, error);
    res.status(500).json({ mensaje: 'No se pudieron obtener los productos de la subcategoría.' });
  }
}

module.exports = {
  obtenerProductosPorSubcategoria
};