const pool = require('../db');

async function ConsultarCalcomaniasPorUsuario(req, res) {
  try {
    // Obtener el ID del usuario desde el token decodificado
    const userId = req.user.id_usuario;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de usuario no encontrado en el token.'
      });
    }

    const [calcomanias] = await pool.execute(`
      SELECT 
        c.nombre,
        c.formato,
        c.url_archivo
      FROM calcomania c
      WHERE c.fk_id_usuario = ?
      ORDER BY c.fecha_subida DESC, c.id_calcomania DESC
    `, [userId]);

    // Formatear los datos
    const calcomaniasFomateadas = calcomanias.map(calcomania => ({
      nombre: calcomania.nombre,
      formato: calcomania.formato,
      url_archivo: calcomania.url_archivo
    }));

    return res.status(200).json({
      success: true,
      mensaje: 'Calcomanías del usuario consultadas exitosamente.',
      calcomanias: calcomaniasFomateadas,
      total: calcomaniasFomateadas.length
    });

  } catch (error) {
    console.error('Error consultando calcomanías del usuario:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor.'
    });
  }
}

module.exports = { ConsultarCalcomaniasPorUsuario };