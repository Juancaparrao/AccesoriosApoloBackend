const pool = require('../db');
const cloudinary = require('../cloudinary');

async function ObtenerDatosCalcomania(req, res) {
  const { id_calcomania } = req.body;

  try {
    // Obtener datos de la calcomanía, incluyendo el usuario relacionado
    const [[calcomania]] = await pool.execute(
      `SELECT c.id_calcomania, c.nombre, c.formato, c.tamano_archivo,
              c.fecha_subida, c.url_archivo, c.fk_id_usuario, u.nombre AS nombre_usuario
       FROM calcomania c
       JOIN usuario u ON c.fk_id_usuario = u.id_usuario
       WHERE c.id_calcomania = ?`,
      [id_calcomania]
    );

    if (!calcomania) {
      return res.status(404).json({
        success: false,
        mensaje: 'Calcomanía no encontrada.'
      });
    }

    // Obtener todos los usuarios activos
    const [usuarios] = await pool.execute(
      `SELECT id_usuario, nombre FROM usuario WHERE estado = 1`
    );

    return res.status(200).json({
      success: true,
      calcomania,
      usuarios  // todos los usuarios para llenar el <select> en el front
    });

  } catch (error) {
    console.error('❌ Error al obtener datos de la calcomanía:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al obtener los datos de la calcomanía.'
    });
  }
}

async function ActualizarCalcomania(req, res) {
  try {
    const { id_calcomania, nombre, fk_id_usuario } = req.body;

    if (!id_calcomania) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'El ID de calcomanía es requerido.' 
      });
    }

    const [resultado] = await pool.execute(`
      SELECT * FROM calcomania WHERE id_calcomania = ?
    `, [id_calcomania]);

    if (resultado.length === 0) {
      return res.status(404).json({ 
        success: false, 
        mensaje: 'Calcomanía no encontrada.' 
      });
    }

    const calcomaniaActual = resultado[0];
    let url_archivo = calcomaniaActual.url_archivo;
    let formato = calcomaniaActual.formato;
    let tamano_archivo = calcomaniaActual.tamano_archivo;
    let fecha_subida = calcomaniaActual.fecha_subida;

    // Si viene una imagen nueva, la sube a Cloudinary y actualiza metadatos
    if (req.file?.path) {
      url_archivo = req.file.path;
      formato = req.file.mimetype.split('/')[1]; // Extrae 'jpg', 'png', etc.
      tamano_archivo = `${(req.file.size / 1024).toFixed(2)} KB`; // Convierte bytes a KB
      fecha_subida = new Date().toISOString().split('T')[0]; // Nueva fecha de subida
    }

    // Verificar que el usuario existe si se está cambiando
    if (fk_id_usuario && fk_id_usuario !== calcomaniaActual.fk_id_usuario) {
      const [usuario] = await pool.execute(
        'SELECT id_usuario FROM usuario WHERE id_usuario = ? AND estado = 1',
        [fk_id_usuario]
      );

      if (usuario.length === 0) {
        return res.status(404).json({ 
          success: false, 
          mensaje: 'Usuario no encontrado o inactivo.' 
        });
      }
    }

    await pool.execute(`
      UPDATE calcomania 
      SET nombre = ?, formato = ?, tamano_archivo = ?, fecha_subida = ?, url_archivo = ?, fk_id_usuario = ?
      WHERE id_calcomania = ?
    `, [
      nombre || calcomaniaActual.nombre,
      formato,
      tamano_archivo,
      fecha_subida,
      url_archivo,
      fk_id_usuario || calcomaniaActual.fk_id_usuario,
      id_calcomania
    ]);

    return res.status(200).json({
      success: true,
      mensaje: 'Calcomanía actualizada correctamente.',
      calcomania: {
        id_calcomania,
        nombre: nombre || calcomaniaActual.nombre,
        formato,
        tamano_archivo,
        fecha_subida,
        url_archivo,
        fk_id_usuario: fk_id_usuario || calcomaniaActual.fk_id_usuario
      }
    });

  } catch (error) {
    console.error('Error al actualizar calcomanía:', error);
    return res.status(500).json({ 
      success: false, 
      mensaje: 'Error interno del servidor.' 
    });
  }
}

module.exports = { ActualizarCalcomania, ObtenerDatosCalcomania };