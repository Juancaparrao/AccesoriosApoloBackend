const pool = require('../db');


async function BuscarCalcomaniaPorNombre(req, res) {
  try {
    const { nombre } = req.query;

    // Validar que se haya proporcionado un nombre para buscar
    if (!nombre) {
      return res.status(400).json({
        success: false,
        mensaje: 'Se requiere un nombre para realizar la búsqueda de calcomanías.'
      });
    }

    // Consulta SQL para obtener todos los campos especificados de la calcomanía
    // y el nombre del usuario asociado, filtrando por nombre de calcomanía.
    const [calcomanias] = await pool.execute(`
      SELECT
        c.id_calcomania,
        c.nombre,
        c.url_archivo,
        c.precio_unidad,
        c.precio_descuento,
        c.stock_pequeno,
        c.stock_mediano,
        c.stock_grande,
        c.estado,
        u.nombre AS nombre_usuario
      FROM calcomania c
      INNER JOIN usuario u ON c.fk_id_usuario = u.id_usuario
      WHERE c.nombre LIKE ?
      ORDER BY c.fecha_subida DESC, c.id_calcomania DESC
    `, [`%${nombre}%`]); // Uso de LIKE para búsqueda parcial

    // Formatear los datos para incluir el estado como texto y asegurar todos los campos
    const calcomaniasFormateadas = calcomanias.map(calcomania => ({
      id_calcomania: calcomania.id_calcomania,
      nombre: calcomania.nombre,
      url_archivo: calcomania.url_archivo,
      precio_unidad: calcomania.precio_unidad,
      precio_descuento: calcomania.precio_descuento,
      stock_pequeno: calcomania.stock_pequeno,
      stock_mediano: calcomania.stock_mediano,
      stock_grande: calcomania.stock_grande,
      estado: calcomania.estado ? 'Activo' : 'Inactivo', // Formatea el booleano 'estado' a texto
      nombre_usuario: calcomania.nombre_usuario
    }));

    // Si no se encuentran calcomanías, se devuelve un mensaje adecuado
    if (calcomaniasFormateadas.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'No se encontraron calcomanías con el nombre especificado.'
      });
    }

    return res.status(200).json({
      success: true,
      mensaje: 'Calcomanías encontradas exitosamente.',
      calcomanias: calcomaniasFormateadas
    });

  } catch (error) {
    console.error('Error al buscar calcomanía por nombre:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor al buscar calcomanía por nombre.'
    });
  }
}

module.exports = { BuscarCalcomaniaPorNombre };
