// controllers/productosController.js (Puedes añadirla al mismo archivo o crear uno nuevo si prefieres)

const pool = require('../db'); // Asegúrate de que la ruta a tu conexión DB sea correcta

async function obtenerProductosPorSubcategoria(req, res) {
  const { nombreSubcategoria } = req.params; // Usamos 'nombreSubcategoria' como parámetro en la URL
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
          subcategoria s ON p.fk_id_subcategoria = s.id_subcategoria -- Unimos con la tabla subcategoria
      LEFT JOIN
          producto_imagen pi ON p.referencia = pi.fk_referencia_producto
      WHERE
          s.nombre_subcategoria = ? -- Filtramos por el nombre de la subcategoría
          AND p.estado = TRUE
          AND p.stock > 0
      GROUP BY p.referencia;
    `;

    const [rows] = await pool.execute(query, [nombreSubcategoria]);

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
      return res.status(404).json({ mensaje: `No se encontraron productos disponibles para la subcategoría '${nombreSubcategoria}'.` });
    }

    res.status(200).json(productosFormateados);
  } catch (error) {
    console.error(`Error al obtener productos para la subcategoría ${nombreSubcategoria}:`, error);
    res.status(500).json({ mensaje: 'No se pudieron obtener los productos de la subcategoría.' });
  }
}

// Exporta también esta nueva función
module.exports = { // Si la tenías en el mismo archivo, la sigues exportando
  obtenerProductosPorSubcategoria
};