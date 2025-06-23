const pool = require('../db');

async function ConsultarCalcomania(req, res) {
  try {
    const [calcomanias] = await pool.execute(`
      SELECT 
        c.id_calcomania,
        c.nombre,
        c.formato,
        c.tamano_archivo,
        c.fecha_subida,
        c.url_archivo,
        c.estado,
        u.nombre AS nombre_usuario,
        r.nombre AS rol_usuario
      FROM calcomania c
      INNER JOIN usuario u ON c.fk_id_usuario = u.id_usuario
      INNER JOIN usuario_rol ur ON u.id_usuario = ur.fk_id_usuario
      INNER JOIN rol r ON ur.id_rol = r.id_rol
      WHERE r.nombre IN ('vendedor', 'gerente')
      ORDER BY c.fecha_subida DESC, c.id_calcomania DESC
    `);

    // Formatear los datos para incluir el estado como texto
    const calcomaniasFomateadas = calcomanias.map(calcomania => ({
      id_calcomania: calcomania.id_calcomania,
      nombre: calcomania.nombre,
      formato: calcomania.formato,
      tamano_archivo: calcomania.tamano_archivo,
      fecha_subida: calcomania.fecha_subida,
      url_archivo: calcomania.url_archivo,
      estado: calcomania.estado ? 'Activo' : 'Inactivo',
      nombre_usuario: calcomania.nombre_usuario,
      rol_usuario: calcomania.rol_usuario
    }));

    return res.status(200).json({
      success: true,
      mensaje: 'Calcomanías consultadas exitosamente.',
      calcomanias: calcomaniasFomateadas
    });

  } catch (error) {
    console.error('Error consultando calcomanías:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor.'
    });
  }
}

module.exports = { ConsultarCalcomania };