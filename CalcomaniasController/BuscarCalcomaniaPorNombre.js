const pool = require('../db');

async function BuscarCalcomaniaPorNombre(req, res) {
  try {
    const { nombre } = req.query;

    const [calcomanias] = await pool.execute(`
      SELECT c.*, u.nombre AS nombre_usuario 
      FROM calcomania c
      JOIN usuario u ON c.fk_id_usuario = u.id_usuario
      WHERE c.nombre LIKE ?
      ORDER BY c.fecha_subida DESC, c.id_calcomania DESC
    `, [`%${nombre}%`]);

    // Formatear los datos para incluir el estado como texto
    const calcomaniasFomateadas = calcomanias.map(calcomania => ({
      id_calcomania: calcomania.id_calcomania,
      nombre: calcomania.nombre,
      formato: calcomania.formato,
      tamano_archivo: calcomania.tamano_archivo,
      fecha_subida: calcomania.fecha_subida,
      url_archivo: calcomania.url_archivo,
      estado: calcomania.estado ? 'Activo' : 'Inactivo',
      nombre_usuario: calcomania.nombre_usuario
    }));

    return res.status(200).json({
      success: true,
      calcomanias: calcomaniasFomateadas
    });

  } catch (error) {
    console.error('Error al buscar calcomanía:', error);
    return res.status(500).json({ 
      success: false, 
      mensaje: 'Error interno al buscar calcomanía.' 
    });
  }
}

module.exports = { BuscarCalcomaniaPorNombre };