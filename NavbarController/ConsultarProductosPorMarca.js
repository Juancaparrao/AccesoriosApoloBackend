const pool = require('../db');

async function obtenerProductosPorMarca(req, res) {
  const { marca } = req.params;

  try {
    let query;
    let queryParams;

    const marcasPrincipales = ['Ich', 'Shaft', 'Hro', 'Arai', 'Shoei'];

    // Nuevo caso para "ver-mas"
    if (marca === 'Ver-más') {
      query = `
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
        LEFT JOIN
            producto_imagen pi ON p.referencia = pi.fk_referencia_producto
        WHERE
            p.estado = TRUE
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
      queryParams = []; // No hay parámetros para esta consulta
    } else if (marca === 'Otros') {
      const placeholders = marcasPrincipales.map(() => '?').join(', ');
      
      query = `
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
        LEFT JOIN
            producto_imagen pi ON p.referencia = pi.fk_referencia_producto
        WHERE
            p.marca NOT IN (${placeholders})
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
      queryParams = [...marcasPrincipales]; 
    } else {
      query = `
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
        LEFT JOIN
            producto_imagen pi ON p.referencia = pi.fk_referencia_producto
        WHERE
            p.marca = ?
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
      queryParams = [marca];
    }

    const [rows] = await pool.execute(query, queryParams);

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

      if (row.descuento !== null && row.descuento > 0 && precioDescuento < precioUnidad) {
        producto.precio_descuento = precioDescuento;
        producto.descuento = `${row.descuento}%`;
      } else {
        producto.precio_descuento = null;
        producto.descuento = null;
      }

      return producto;
    });

    if (productosFormateados.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: `No se encontraron productos disponibles para la selección '${marca}'.`
      });
    }

    res.status(200).json({
      success: true,
      productos: productosFormateados
    });

  } catch (error) {
    console.error(`Error al obtener productos para la marca ${marca}:`, error);
    res.status(500).json({ mensaje: 'No se pudieron obtener los productos.' });
  }
}

module.exports = {
  obtenerProductosPorMarca
};