const pool = require('../db');

async function RegistrarCalcomania(req, res) {
  try {
    const { nombre, fk_id_usuario } = req.body;

    // Validar datos requeridos
    if (!nombre || !fk_id_usuario || !req.file?.path) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'Faltan datos requeridos: nombre, usuario o imagen.' 
      });
    }

    // Verificar que el usuario existe
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

    // Obtener datos de la imagen desde Cloudinary
    const url_archivo = req.file.path;
    const formato = req.file.mimetype.split('/')[1]; // Extrae 'jpg', 'png', etc.
    const tamano_archivo = `${(req.file.size / 1024).toFixed(2)} KB`; // Convierte bytes a KB
    const fecha_subida = new Date().toISOString().split('T')[0]; // Fecha actual en formato YYYY-MM-DD

    // Insertar la calcomanía en la base de datos
    const [result] = await pool.execute(
      `INSERT INTO calcomania (nombre, formato, tamano_archivo, fecha_subida, url_archivo, fk_id_usuario, estado)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [nombre, formato, tamano_archivo, fecha_subida, url_archivo, fk_id_usuario]
    );

    return res.status(201).json({
      success: true,
      mensaje: 'Calcomanía registrada exitosamente.',
      calcomania: {
        id_calcomania: result.insertId,
        nombre,
        formato,
        tamano_archivo,
        fecha_subida,
        url_archivo,
        fk_id_usuario,
        estado: true
      }
    });

  } catch (error) {
    console.error('Error registrando calcomanía:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error interno del servidor.' 
    });
  }
}

module.exports = { RegistrarCalcomania };