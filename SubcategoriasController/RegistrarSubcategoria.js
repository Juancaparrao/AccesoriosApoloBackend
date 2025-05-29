const pool = require('../db');

async function RegistrarSubcategoria(req, res) {
  try {
    const { nombre_subcategoria, descripcion, descuento, FK_id_categoria } = req.body;

    if (!nombre_subcategoria || descuento === undefined || !FK_id_categoria || !req.file?.path) {
      return res.status(400).json({ success: false, mensaje: 'Faltan datos requeridos o imagen.' });
    }

    const [existente] = await pool.execute(
      'SELECT * FROM subcategoria WHERE nombre_subcategoria = ?',
      [nombre_subcategoria]
    );

    if (existente.length > 0) {
      return res.status(409).json({ success: false, mensaje: 'Subcategoría ya existente.' });
    }

    const url_imagen = req.file.path;

    await pool.execute(
      `INSERT INTO subcategoria (nombre_subcategoria, descripcion, descuento, url_imagen, FK_id_categoria, estado)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [nombre_subcategoria, descripcion || null, descuento, url_imagen, FK_id_categoria]
    );

    return res.status(201).json({
      success: true,
      mensaje: 'Subcategoría registrada exitosamente.',
      imagen: url_imagen
    });

  } catch (error) {
    console.error('Error registrando subcategoría:', error);
    res.status(500).json({ success: false, mensaje: 'Error interno del servidor.' });
  }
}

module.exports = { RegistrarSubcategoria };
