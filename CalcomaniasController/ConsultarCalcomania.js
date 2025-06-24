const pool = require('../db');


async function ConsultarCalcomania(req, res) {
  try {
    const [calcomanias] = await pool.execute(`
      SELECT
        c.id_calcomania,
        c.nombre,
        c.url_archivo,
        c.precio_unidad,
        c.precio_descuento,
        c.stock_pequeño,
        c.stock_mediano,
        c.stock_grande,
        c.estado,
        u.nombre AS nombre_usuario
      FROM calcomania c
      INNER JOIN usuario u ON c.fk_id_usuario = u.id_usuario
      ORDER BY c.fecha_subida DESC, c.id_calcomania DESC
    `);

    // Formatear los datos para incluir el estado como texto y asegurar todos los campos
    const calcomaniasFormateadas = calcomanias.map(calcomania => ({
      id_calcomania: calcomania.id_calcomania,
      nombre: calcomania.nombre,
      url_archivo: calcomania.url_archivo,
      precio_unidad: calcomania.precio_unidad,
      precio_descuento: calcomania.precio_descuento,
      stock_pequeño: calcomania.stock_pequeño,
      stock_mediano: calcomania.stock_mediano,
      stock_grande: calcomania.stock_grande,
      estado: calcomania.estado ? 'Activo' : 'Inactivo',
      nombre_usuario: calcomania.nombre_usuario
    }));

    return res.status(200).json({
      success: true,
      mensaje: 'Calcomanías consultadas exitosamente.',
      calcomanias: calcomaniasFormateadas
    });

  } catch (error) {
    console.error('Error consultando calcomanías:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor al consultar calcomanías.'
    });
  }
}

module.exports = { ConsultarCalcomania };
