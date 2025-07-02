// controllers/productosController.js

const pool = require('../db');

async function obtenerProductosPorSubcategoria(req, res) {
  const { nombre_subcategoria } = req.params;

  try {
    const query = `
      SELECT
          p.referencia,
          p.nombre,
          p.marca,
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
          p.referencia, 
          p.nombre,
          p.marca,
          p.promedio_calificacion,
          p.descuento,
          p.precio_descuento,
          p.precio_unidad;
    `;

    const [rows] = await pool.execute(query, [nombre_subcategoria]);

    const productosFormateados = rows.map(row => {
      const precioUnidad = parseFloat(row.precio_unidad);
      const precioDescuento = parseFloat(row.precio_descuento);

      const producto = {
        referencia: row.referencia,
        nombre: row.nombre,
        marca: row.marca,
        url_imagen: row.url_imagen,
        calificacion: parseFloat(row.calificacion),
        precio_unidad: precioUnidad,
      };

      if (
        row.precio_descuento !== null &&
        precioDescuento !== precioUnidad
      ) {
        producto.precio_descuento = precioDescuento;
        producto.descuento = row.descuento ? `${row.descuento}%` : null;
      }

      return producto;
    });

    if (productosFormateados.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: `No se encontraron productos disponibles para la subcategoría '${nombre_subcategoria}'.`
      });
    }

    res.status(200).json({
      success: true,
      productos: productosFormateados
    });

  } catch (error) {
    console.error(`Error al obtener productos para la subcategoría ${nombre_subcategoria}:`, error);
    res.status(500).json({ mensaje: 'No se pudieron obtener los productos de la subcategoría.' });
  }
}

module.exports = {
  obtenerProductosPorSubcategoria
};
