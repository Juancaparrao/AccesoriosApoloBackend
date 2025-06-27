const pool = require('../db');

async function ConsultarProductoPorSubcategoria(req, res) {
  try {
    console.log("=== DEBUG BACKEND - Consultar Productos Activos por Nombre de Subcategoría (Campos Específicos) ===");
    // El nombre de la subcategoría se espera en los parámetros de la URL, por ejemplo: /productos-por-subcategoria/Auriculares
    const { nombre_subcategoria } = req.params; 

    // 1. Validar que el nombre de la subcategoría esté presente
    if (!nombre_subcategoria || typeof nombre_subcategoria !== 'string' || nombre_subcategoria.trim() === '') {
      return res.status(400).json({
        success: false,
        mensaje: 'Nombre de subcategoría no proporcionado o no es válido.'
      });
    }

    // 2. Ejecutar la consulta SQL para obtener los productos activos.
    // Realizamos un JOIN con la tabla SUBCATEGORIA para filtrar por nombre_subcategoria
    // y un WHERE para filtrar por estado activo.
    const [productosQueryResult] = await pool.execute(
      `SELECT
         p.referencia,
         p.nombre,
         p.url_archivo,
         p.precio_unidad,
         p.descuento,          -- Seleccionamos el descuento
         p.precio_descuento,   -- Seleccionamos el precio_descuento
         p.marca,
         p.promedio_calificacion
       FROM
         producto p
       JOIN
         subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
       WHERE
         s.nombre_subcategoria = ? AND p.estado = TRUE`,
      [nombre_subcategoria]
    );

    // 3. Procesar los resultados para incluir 'descuento' y 'precio_descuento' condicionalmente
    const productos = productosQueryResult.map(producto => {
      const formattedProducto = {
        referencia: producto.referencia,
        nombre: producto.nombre,
        url_archivo: producto.url_archivo,
        precio_unidad: parseFloat(producto.precio_unidad), // Aseguramos que sea un número
        marca: producto.marca,
        promedio_calificacion: parseFloat(producto.promedio_calificacion) // Aseguramos que sea un número
      };

      // Si tiene descuento, lo agregamos al objeto
      if (producto.descuento !== null && producto.descuento !== undefined) {
        formattedProducto.descuento = parseInt(producto.descuento, 10); // Aseguramos que sea un número
      }

      // Si tiene precio_descuento, lo agregamos al objeto
      if (producto.precio_descuento !== null && producto.precio_descuento !== undefined) {
        formattedProducto.precio_descuento = parseFloat(producto.precio_descuento); // Aseguramos que sea un número
      }

      return formattedProducto;
    });


    // 4. Verificar si se encontraron productos
    if (productos.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: `No se encontraron productos activos para la subcategoría con nombre "${nombre_subcategoria}".`
      });
    }

    // 5. Devolver la respuesta con los productos encontrados
    return res.status(200).json({
      success: true,
      mensaje: `Productos activos de la subcategoría "${nombre_subcategoria}" consultados exitosamente.`,
      productos: productos
    });

  } catch (error) {
    console.error('Error al consultar productos por nombre de subcategoría:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor al consultar productos por subcategoría.'
    });
  }
}

module.exports = {
  ConsultarProductoPorSubcategoria
};
