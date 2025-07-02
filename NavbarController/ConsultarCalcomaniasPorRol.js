const pool = require('../db');

async function ConsultarCalcomaniasPorRol(req, res) {
  try {
    console.log("=== DEBUG BACKEND - Consultar Calcomanías por Staff (Gerente/Vendedor) ===");

    const [calcomaniasQueryResult] = await pool.execute(
      `SELECT
         c.id_calcomania,
         c.nombre,
         c.url_archivo,
         c.precio_unidad,
         c.precio_descuento
       FROM
         calcomania c
       JOIN
         usuario u ON c.fk_id_usuario = u.id_usuario
       JOIN
         usuario_rol ur ON u.id_usuario = ur.fk_id_usuario
       JOIN
         rol r ON ur.id_rol = r.id_rol
       WHERE
         (r.nombre = 'gerente' OR r.nombre = 'vendedor') AND c.estado = TRUE AND c.stock_pequeno > 0 AND c.stock_mediano > 0 AND c.stock_grande > 0
       GROUP BY
         c.id_calcomania, c.nombre, c.url_archivo, c.precio_unidad, c.precio_descuento`,
      [] // No hay parámetros para esta consulta WHERE
    );

    // 2. Procesar los resultados para calcular y incluir 'descuento' condicionalmente
    const calcomanias = calcomaniasQueryResult.map(calcomania => {
      const formattedCalcomania = {
        id_calcomania: calcomania.id_calcomania,
        nombre: calcomania.nombre,
        url_archivo: calcomania.url_archivo,
        precio_unidad: parseFloat(calcomania.precio_unidad) // Aseguramos que sea un número
      };

      // Si tiene precio_descuento, lo agregamos y calculamos el 'descuento'
      if (calcomania.precio_descuento !== null && calcomania.precio_descuento !== undefined) {
        formattedCalcomania.precio_descuento = parseFloat(calcomania.precio_descuento); // Aseguramos que sea un número
        
        // Calcular el porcentaje de descuento si precio_unidad es > 0
        if (formattedCalcomania.precio_unidad > 0) {
          const descuentoPorcentaje = ((formattedCalcomania.precio_unidad - formattedCalcomania.precio_descuento) / formattedCalcomania.precio_unidad) * 100;
          formattedCalcomania.descuento = parseFloat(descuentoPorcentaje.toFixed(2)); // Redondeamos a 2 decimales
        }
      }

      return formattedCalcomania;
    });

    // 3. Verificar si se encontraron calcomanías
    if (calcomanias.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'No se encontraron calcomanías activas registradas por gerentes o vendedores.'
      });
    }

    // 4. Devolver la respuesta con las calcomanías encontradas
    return res.status(200).json({
      success: true,
      mensaje: 'Calcomanías registradas por gerentes/vendedores consultadas exitosamente.',
      calcomanias: calcomanias
    });

  } catch (error) {
    console.error('Error al consultar calcomanías por staff:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor al consultar calcomanías.'
    });
  }
}

module.exports = {
  ConsultarCalcomaniasPorRol
};
