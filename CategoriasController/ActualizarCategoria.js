const pool = require('../db');

async function ObtenerDatosCategoria(req, res) {
  const { id_categoria } = req.body;

  try {
    const [rows] = await pool.execute(
      `SELECT id_categoria, nombre_categoria, descripcion, descuento
       FROM CATEGORIA
       WHERE id_categoria = ?`,
      [id_categoria]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Categoría no encontrada.'
      });
    }

    return res.status(200).json({
      success: true,
      categoria: rows[0]
    });

  } catch (error) {
    console.error('Error al obtener datos de la categoría:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al obtener los datos de la categoría.'
    });
  }
}

async function ActualizarCategoria(req, res) {
  const {
    id_categoria_original,
    id_categoria,
    nombre_categoria,
    descripcion,
    descuento
  } = req.body;

  if (!id_categoria_original || !nombre_categoria || descuento == null) {
    return res.status(400).json({
      success: false,
      mensaje: 'Faltan campos obligatorios.'
    });
  }

  try {
    // Verificar si la categoría original existe
    const [categorias] = await pool.execute(
      'SELECT id_categoria FROM CATEGORIA WHERE id_categoria = ?',
      [id_categoria_original]
    );

    if (categorias.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Categoría no encontrada.'
      });
    }

    // Validar si ya existe otra categoría con el mismo nombre
    const [nombreExiste] = await pool.execute(
      'SELECT id_categoria FROM CATEGORIA WHERE nombre_categoria = ? AND id_categoria != ?',
      [nombre_categoria, id_categoria_original]
    );

    if (nombreExiste.length > 0) {
      return res.status(409).json({
        success: false,
        mensaje: 'Ya existe otra categoría con ese nombre.'
      });
    }

    // Actualizar datos
    await pool.execute(
      `UPDATE CATEGORIA
       SET nombre_categoria = ?, descripcion = ?, descuento = ?
       WHERE id_categoria = ?`,
      [nombre_categoria, descripcion, descuento, id_categoria_original]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Categoría actualizada correctamente.'
    });

  } catch (error) {
    console.error('Error al actualizar la categoría:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al actualizar la categoría.'
    });
  }
}

module.exports = { ObtenerDatosCategoria, ActualizarCategoria };
