const pool = require('../db');

async function RegistrarCategoria(req, res) {
  try {
    const { nombre_categoria, descripcion, descuento } = req.body;

    // Validación de campos obligatorios
    if (!nombre_categoria || descuento === undefined) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan campos obligatorios: nombre_categoria o descuento.'
      });
    }

    // Verificar si ya existe una categoría con el mismo nombre
    const [existente] = await pool.execute(
      `SELECT * FROM categoria WHERE nombre_categoria = ?`,
      [nombre_categoria]
    );

    if (existente.length > 0) {
      return res.status(409).json({
        success: false,
        mensaje: 'Ya existe una categoría con ese nombre.'
      });
    }

    // Insertar categoría con estado = 1 (activa)
    await pool.execute(
      `INSERT INTO categoria (nombre_categoria, descripcion, descuento, estado)
       VALUES (?, ?, ?, ?)`,
      [nombre_categoria, descripcion || null, descuento, 1]
    );

    return res.status(201).json({
      success: true,
      mensaje: 'Categoría registrada exitosamente.'
    });

  } catch (error) {
    console.error('Error al registrar categoría:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al registrar la categoría.'
    });
  }
}

module.exports = { RegistrarCategoria };
