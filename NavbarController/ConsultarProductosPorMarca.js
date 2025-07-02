const pool = require('../db'); // Asegúrate de que la ruta a tu conexión DB sea correcta

async function obtenerProductosPorMarca(req, res) {
  const { nombreMarca } = req.params; // Usamos 'nombreMarca' como parámetro en la URL
  try {
    let query;
    let queryParams;

    // Define las marcas "principales" a excluir cuando se busca "Otros"
    const marcasPrincipales = ['Ich', 'Shaft', 'Hro', 'Arai', 'Shoei'];

    if (nombreMarca === 'Otros') {
      // Si la marca es 'Otros', seleccionamos productos cuya marca NO esté en la lista de marcas principales
      query = `
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
        LEFT JOIN
            producto_imagen pi ON p.referencia = pi.fk_referencia_producto
        WHERE
            p.marca NOT IN (?)
            AND p.estado = TRUE
            AND p.stock > 0
        GROUP BY p.referencia;
      `;
      // Convertimos el array de marcas a una lista separada por comas para el NOT IN
      queryParams = [marcasPrincipales];
    } else {
      // Si es una marca específica, filtramos directamente por ella
      query = `
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
        LEFT JOIN
            producto_imagen pi ON p.referencia = pi.fk_referencia_producto
        WHERE
            p.marca = ?
            AND p.estado = TRUE
            AND p.stock > 0
        GROUP BY p.referencia;
      `;
      queryParams = [nombreMarca];
    }

    const [rows] = await pool.execute(query, queryParams);

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
      return res.status(404).json({ mensaje: `No se encontraron productos disponibles para la marca '${nombreMarca}'.` });
    }

    res.status(200).json(productosFormateados);
  } catch (error) {
    console.error(`Error al obtener productos para la marca ${nombreMarca}:`, error);
    res.status(500).json({ mensaje: 'No se pudieron obtener los productos de la marca.' });
  }
}

// Exporta esta nueva función junto con las anteriores
module.exports = {
  obtenerProductosPorMarca // ¡Añadida esta!
};